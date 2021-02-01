// SPDX-License-Identifier: UNLICENSED
/*
Original work taken from https://github.com/JoinColony/colonyToken/blob/master/contracts/Vesting.sol and https://github.com/tapmydata/tap-protocol/blob/main/contracts/VestingVault.sol
Has been amended to use with erc721 tokenIds. Allows several grants per address.
*/
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// import "hardhat/console.sol";

contract VestingVault is Ownable {
    using SafeMath for uint256;
    using SafeMath for uint16;

    uint256 internal constant ONE_MONTH = 2628000;
    uint256[3] internal constant periods = [1 days, 1 weeks, ONE_MONTH];

    uint256 public vestingPeriod;
    uint16 public vestingDuration;
    uint16 public vestingCliff;

    ERC20 public token;

    struct Grant {
        address recipient;
        uint256 amount;
        uint256 startTime;
        uint16 periodsClaimed;
        uint256 totalClaimed;
    }

    event GrantAdded(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amount
    );
    event GrantTokensClaimed(address indexed recipient, uint256 amountClaimed);
    event GrantTransfered(address indexed recipient);
    event GrantRevoked(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amountVested,
        uint256 amountNotVested
    );

    // unique erc721 token id to token grants relation
    mapping(uint256 => Grant) private tokenGrants;

    /// @param _vestingPeriod The choosed period of time (1 days(0), 1 weeks(1), 1 months(2))
    /// @param _vestingDurationInPeriods Number of periods of the grant's duration
    /// @param _vestingCliffInPeriods Number of periods of the grant's vesting cliff
    constructor(
        ERC20 _token,
        uint8 _vestingPeriod,
        uint16 _vestingDurationInPeriods,
        uint16 _vestingCliffInPeriods
    ) public {
        require(address(_token) != address(0));
        token = _token;

        vestingPeriod = periods[_vestingPeriod];
        vestingDuration = _vestingDurationInPeriods;
        vestingCliff = _vestingCliffInPeriods;
    }

    /// @notice Add a new token grant for an erc721 token with `_tokenId`.
    /// The amount of tokens here need to be preapproved for transfer by this `Vesting` contract before this call
    /// @param _tokenId Grant unique erc721 token id
    /// @param _recipient Address of the token grant recipient entitled to claim the grant funds
    /// @param _amount Total number of tokens in
    function addTokenGrant(
        uint256 _tokenId,
        address _recipient,
        uint256 _amount
    ) external onlyOwner {
        require(tokenGrants[_tokenId].amount == 0, "Grant already exists");
        uint256 amountVestedPerPeriod = _amount.div(uint256(vestingDuration));
        require(amountVestedPerPeriod > 0, "amountVestedPerPeriod > 0");

        // Transfer the grant tokens under the control of the vesting contract
        require(token.transferFrom(owner(), address(this), _amount));

        Grant memory grant =
            Grant({
                recipient: _recipient,
                startTime: currentTime(),
                amount: _amount,
                periodsClaimed: 0,
                totalClaimed: 0
            });

        tokenGrants[_tokenId] = grant;
        emit GrantAdded(_tokenId, _recipient, grant.amount);
    }

    function claimVestedTokens(uint256 _tokenId) public onlyOwner {
        uint16 periodsVested;
        uint256 amountVested;
        (periodsVested, amountVested) = calculateGrantClaim(_tokenId);

        require(amountVested > 0, "Vested is 0");

        Grant storage tokenGrant = tokenGrants[_tokenId];

        tokenGrant.periodsClaimed = uint16(
            tokenGrant.periodsClaimed.add(periodsVested)
        );
        tokenGrant.totalClaimed = uint256(
            tokenGrant.totalClaimed.add(amountVested)
        );

        require(
            token.transfer(tokenGrant.recipient, amountVested),
            "no tokens"
        );
        emit GrantTokensClaimed(tokenGrant.recipient, amountVested);
    }

    /// @notice Terminate token grant transferring all vested tokens to the grant `recipient`
    /// and returning all non-vested tokens to the contract owner
    /// Secured to the contract owner only
    /// @param _tokenId Grant unique erc721 token id
    function revokeTokenGrant(uint256 _tokenId) external onlyOwner {
        uint16 periodsVested;
        uint256 amountVested;
        (periodsVested, amountVested) = calculateGrantClaim(_tokenId);

        Grant storage tokenGrant = tokenGrants[_tokenId];

        uint256 amountNotVested =
            (tokenGrant.amount.sub(tokenGrant.totalClaimed)).sub(amountVested);

        require(token.transfer(owner(), amountNotVested));
        require(token.transfer(tokenGrant.recipient, amountVested));

        emit GrantRevoked(
            _tokenId,
            tokenGrant.recipient,
            amountVested,
            amountNotVested
        );

        tokenGrant.recipient = address(0);
        tokenGrant.startTime = 0;
        tokenGrant.amount = 0;
        tokenGrant.periodsClaimed = 0;
        tokenGrant.totalClaimed = 0;
    }

    /// @notice Transfer the recipient of a token grant with `_tokenId`
    function transferTokenGrantRecipient(uint256 _tokenId, address _recipient)
        external
        onlyOwner
    {
        claimVestedTokens(_tokenId);

        Grant storage tokenGrant = tokenGrants[_tokenId];
        tokenGrant.recipient = _recipient;

        emit GrantTransfered(_recipient);
    }

    function getGrantStartTime(uint256 _tokenId) public view returns (uint256) {
        Grant storage tokenGrant = tokenGrants[_tokenId];
        return tokenGrant.startTime;
    }

    function getGrantAmount(uint256 _tokenId) public view returns (uint256) {
        Grant storage tokenGrant = tokenGrants[_tokenId];
        return tokenGrant.amount;
    }

    function getGrantRecipient(uint256 _tokenId) public view returns (address) {
        Grant storage tokenGrant = tokenGrants[_tokenId];
        return tokenGrant.recipient;
    }

    /// @notice Calculate the vested and unclaimed days and tokens available for `_grantId` to claim
    /// Due to rounding errors once grant duration is reached, returns the entire left grant amount
    /// Returns (0, 0) if cliff has not been reached
    function calculateGrantClaim(uint256 _tokenId)
        private
        view
        returns (uint16, uint256)
    {
        Grant storage tokenGrant = tokenGrants[_tokenId];

        require(
            tokenGrant.totalClaimed < tokenGrant.amount,
            "Grant fully claimed"
        );

        // Check cliff was reached
        uint256 elapsedPeriods =
            currentTime().sub(tokenGrant.startTime).div(vestingPeriod);

        if (elapsedPeriods < vestingCliff) {
            return (0, 0);
        }

        // If over vesting duration, all tokens vested
        if (elapsedPeriods >= vestingDuration) {
            uint256 remainingGrant =
                tokenGrant.amount.sub(tokenGrant.totalClaimed);
            return (vestingDuration, remainingGrant);
        } else {
            uint16 periodsVested =
                uint16(elapsedPeriods.sub(tokenGrant.periodsClaimed));
            uint256 amountVestedPerPeriod =
                tokenGrant.amount.div(uint256(vestingDuration));
            uint256 amountVested =
                uint256(periodsVested.mul(amountVestedPerPeriod));
            return (periodsVested, amountVested);
        }
    }

    function currentTime() private view returns (uint256) {
        return block.timestamp;
    }
}
