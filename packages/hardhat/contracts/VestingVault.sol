// SPDX-License-Identifier: UNLICENSED
/*
Original work taken from https://github.com/JoinColony/colonyToken/blob/master/contracts/Vesting.sol and https://github.com/tapmydata/tap-protocol/blob/main/contracts/VestingVault.sol
Has been amended to use with erc721 tokenIds. Allows several grants per address.
*/
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "hardhat/console.sol";

contract VestingVault {
    using SafeMath for uint256;
    using SafeMath for uint16;

    uint256 internal constant ONE_MONTH = 2628000;
    uint256[3] internal periodUnits = [1 days, 1 weeks, ONE_MONTH];

    uint256 public vestingPeriod;
    uint16 public vestingDuration;
    uint16 public vestingCliff;

    ERC20 public token;

    struct Vesting {
        address recipient;
        uint256 amount;
        uint256 startTime;
        uint16 periodsClaimed;
        uint256 totalClaimed;
    }

    event VestingAdded(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amount
    );
    event VestingRevoked(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amountVested
    );
    event VestingTokensClaimed(
        address indexed recipient,
        uint256 amountClaimed
    );
    event VestingRecipientTransfered(address indexed recipient);

    // unique erc721 token id to token vesting relation
    mapping(uint256 => Vesting) private tokenVestings;

    /// @param _vestingPeriodUnit The choosed period of time (1 days(0), 1 weeks(1), 1 months(2))
    /// @param _vestingDurationInPeriods Number of periods of the grant's duration
    /// @param _vestingCliffInPeriods Number of periods of the grant's vesting cliff
    constructor(
        address _token,
        uint8 _vestingPeriodUnit,
        uint16 _vestingDurationInPeriods,
        uint16 _vestingCliffInPeriods
    ) public {
        require(address(_token) != address(0));
        require(_vestingDurationInPeriods > _vestingCliffInPeriods);

        token = ERC20(_token);

        vestingPeriod = periodUnits[_vestingPeriodUnit];
        vestingDuration = _vestingDurationInPeriods;
        vestingCliff = _vestingCliffInPeriods;
    }

    function claimVestedTokens(uint256 _tokenId) public {
        uint16 periodsVested;
        uint256 amountVested;
        (periodsVested, amountVested) = calculateVestingClaim(_tokenId);
        require(amountVested > 0, "Vested is 0");

        Vesting storage tokenVesting = tokenVestings[_tokenId];

        tokenVesting.periodsClaimed = uint16(
            tokenVesting.periodsClaimed.add(periodsVested)
        );
        tokenVesting.totalClaimed = uint256(
            tokenVesting.totalClaimed.add(amountVested)
        );

        require(
            token.transfer(tokenVesting.recipient, amountVested),
            "no tokens"
        );
        emit VestingTokensClaimed(tokenVesting.recipient, amountVested);
    }

    function getVestingStartTime(uint256 _tokenId)
        public
        view
        returns (uint256)
    {
        Vesting storage tokenVesting = tokenVestings[_tokenId];
        return tokenVesting.startTime;
    }

    function getVestingAmount(uint256 _tokenId) public view returns (uint256) {
        Vesting storage tokenVesting = tokenVestings[_tokenId];
        return tokenVesting.amount;
    }

    function getVestingRecipient(uint256 _tokenId)
        public
        view
        returns (address)
    {
        Vesting storage tokenVesting = tokenVestings[_tokenId];
        return tokenVesting.recipient;
    }

    /// @notice Add a new token grant for an erc721 token with `_tokenId`.
    /// The amount of tokens here need to be preapproved for transfer by this `Vesting` contract before this call
    /// @param _tokenId Vesting unique erc721 token id
    /// @param _recipient Address of the token grant recipient entitled to claim the grant funds
    /// @param _amount Total number of tokens in
    function _addTokenVesting(
        uint256 _tokenId,
        address _recipient,
        uint256 _amount
    ) internal {
        require(tokenVestings[_tokenId].amount == 0, "Vesting already exists");
        uint256 amountVestedPerPeriod = _amount.div(uint256(vestingDuration));
        require(amountVestedPerPeriod > 0, "amountVestedPerPeriod > 0");

        Vesting memory vesting =
            Vesting({
                recipient: _recipient,
                startTime: currentTime(),
                amount: _amount,
                periodsClaimed: 0,
                totalClaimed: 0
            });

        tokenVestings[_tokenId] = vesting;
        emit VestingAdded(_tokenId, _recipient, vesting.amount);
    }

    /// @notice Terminate token vesting transferring all vested tokens to the vesting `recipient`
    /// and returning all non-vested tokens to the contract owner
    /// Secured to the contract owner only
    /// @param _tokenId Vesting unique erc721 token id
    function _revokeTokenVesting(uint256 _tokenId) internal {
        uint16 periodsVested;
        uint256 amountVested;
        (periodsVested, amountVested) = calculateVestingClaim(_tokenId);

        Vesting storage tokenVesting = tokenVestings[_tokenId];
        address recipient = tokenVesting.recipient;

        tokenVesting.recipient = address(0);
        tokenVesting.startTime = 0;
        tokenVesting.amount = 0;
        tokenVesting.periodsClaimed = 0;
        tokenVesting.totalClaimed = 0;

        require(token.transfer(recipient, amountVested));

        emit VestingRevoked(_tokenId, recipient, amountVested);
    }

    /// @notice Transfer the recipient of a token grant with `_tokenId`
    function _transferVestingRecipient(uint256 _tokenId, address _recipient)
        internal
    {
        claimVestedTokens(_tokenId);

        Vesting storage tokenVesting = tokenVestings[_tokenId];
        tokenVesting.recipient = _recipient;

        emit VestingRecipientTransfered(_recipient);
    }

    /// @notice Calculate the vested and unclaimed days and tokens available for `_grantId` to claim
    /// Due to rounding errors once grant duration is reached, returns the entire left grant amount
    /// Returns (0, 0) if cliff has not been reached
    function calculateVestingClaim(uint256 _tokenId)
        private
        view
        returns (uint16, uint256)
    {
        Vesting storage tokenVesting = tokenVestings[_tokenId];

        require(
            tokenVesting.totalClaimed < tokenVesting.amount,
            "Vesting fully claimed"
        );

        // Check cliff was reached
        uint256 elapsedPeriods =
            currentTime().sub(tokenVesting.startTime).div(vestingPeriod);

        if (elapsedPeriods < vestingCliff) {
            return (0, 0);
        }

        // If over vesting duration, all tokens vested
        if (elapsedPeriods >= vestingDuration) {
            uint256 remainingVesting =
                tokenVesting.amount.sub(tokenVesting.totalClaimed);
            return (vestingDuration, remainingVesting);
        } else {
            uint16 periodsVested =
                uint16(elapsedPeriods.sub(tokenVesting.periodsClaimed));
            uint256 amountVestedPerPeriod =
                tokenVesting.amount.div(uint256(vestingDuration));
            uint256 amountVested =
                uint256(periodsVested.mul(amountVestedPerPeriod));
            return (periodsVested, amountVested);
        }
    }

    function currentTime() private view returns (uint256) {
        return block.timestamp;
    }
}
