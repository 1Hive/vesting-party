// SPDX-License-Identifier: UNLICENSED
/*
Original work taken from https://github.com/JoinColony/colonyToken/blob/master/contracts/Vesting.sol and https://github.com/tapmydata/tap-protocol/blob/main/contracts/VestingVault.sol
Has been amended to use with erc721 tokenIds. Allows several grants per address.
*/
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

contract VestingVault is Ownable {
    using SafeMath for uint256;
    using SafeMath for uint16;

    struct Grant {
        address recipient;
        uint256 amount;
        uint256 startTime;
        uint16 vestingDuration;
        uint16 vestingCliff;
        uint16 daysClaimed;
        uint256 totalClaimed;
    }

    event GrantAdded(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amount,
        uint16 vestingDuration,
        uint16 vestingCliff
    );
    event GrantTokensClaimed(address indexed recipient, uint256 amountClaimed);
    event GrantTransfered(address indexed recipient);
    event GrantRevoked(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 amountVested,
        uint256 amountNotVested
    );

    ERC20 public token;

    mapping(uint256 => Grant) private tokenGrants;

    constructor(ERC20 _token) public {
        require(address(_token) != address(0));
        token = _token;
    }

    /// @notice Add a new token grant for an erc721 token with `_tokenId`.
    /// The amount of tokens here need to be preapproved for transfer by this `Vesting` contract before this call
    /// @param _tokenId Grant unique erc721 token id
    /// @param _recipient Address of the token grant recipient entitled to claim the grant funds
    /// @param _amount Total number of tokens in
    /// @param _startTime Grant start time as seconds since unix epoch
    /// Allows backdating grants by passing time in the past. If `0` is passed here current blocktime is used.
    /// @param _vestingDurationInDays Number of days of the grant's duration
    /// @param _vestingCliffInDays Number of days of the grant's vesting cliff
    function addTokenGrant(
        uint256 _tokenId,
        address _recipient,
        uint256 _amount,
        uint256 _startTime,
        uint16 _vestingDurationInDays,
        uint16 _vestingCliffInDays
    ) external onlyOwner {
        require(tokenGrants[_tokenId].amount == 0, "Grant already exists");
        require(
            _vestingDurationInDays > _vestingCliffInDays,
            "Token cliff longer than duration."
        );

        uint256 amountVestedPerDay = _amount.div(_vestingDurationInDays);
        require(amountVestedPerDay > 0, "amountVestedPerDay > 0");

        // Transfer the grant tokens under the control of the vesting contract
        require(token.transferFrom(owner(), address(this), _amount));

        Grant memory grant =
            Grant({
                recipient: _recipient,
                startTime: _startTime == 0 ? currentTime() : _startTime,
                amount: _amount,
                vestingDuration: _vestingDurationInDays,
                vestingCliff: _vestingCliffInDays,
                daysClaimed: 0,
                totalClaimed: 0
            });

        tokenGrants[_tokenId] = grant;
        emit GrantAdded(
            _tokenId,
            _recipient,
            grant.amount,
            grant.vestingDuration,
            grant.vestingCliff
        );
    }

    function claimVestedTokens(uint256 _tokenId) public onlyOwner {
        uint16 daysVested;
        uint256 amountVested;
        (daysVested, amountVested) = calculateGrantClaim(_tokenId);

        require(amountVested > 0, "Vested is 0");

        Grant storage tokenGrant = tokenGrants[_tokenId];
        tokenGrant.daysClaimed = uint16(tokenGrant.daysClaimed.add(daysVested));
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
        uint16 daysVested;
        uint256 amountVested;
        (daysVested, amountVested) = calculateGrantClaim(_tokenId);

        Grant storage tokenGrant = tokenGrants[_tokenId];
        address recipient = tokenGrant.recipient;

        uint256 amountNotVested =
            (tokenGrant.amount.sub(tokenGrant.totalClaimed)).sub(amountVested);

        require(token.transfer(owner(), amountNotVested));
        require(token.transfer(recipient, amountVested));

        tokenGrant.recipient = address(0);
        tokenGrant.startTime = 0;
        tokenGrant.amount = 0;
        tokenGrant.vestingDuration = 0;
        tokenGrant.vestingCliff = 0;
        tokenGrant.daysClaimed = 0;
        tokenGrant.totalClaimed = 0;

        emit GrantRevoked(_tokenId, recipient, amountVested, amountNotVested);
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

        // For grants created with a future start date, that hasn't been reached, return 0, 0
        if (currentTime() < tokenGrant.startTime) {
            console.log("future start");
            return (0, 0);
        }

        // Check cliff was reached
        uint256 elapsedDays =
            currentTime().sub(tokenGrant.startTime).div(1 days);

        console.log("elapsedDays:", elapsedDays);

        if (elapsedDays < tokenGrant.vestingCliff) {
            return (0, 0);
        }

        // If over vesting duration, all tokens vested
        if (elapsedDays >= tokenGrant.vestingDuration) {
            uint256 remainingGrant =
                tokenGrant.amount.sub(tokenGrant.totalClaimed);
            return (tokenGrant.vestingDuration, remainingGrant);
        } else {
            uint16 daysVested = uint16(elapsedDays.sub(tokenGrant.daysClaimed));
            uint256 amountVestedPerDay =
                tokenGrant.amount.div(uint256(tokenGrant.vestingDuration));
            uint256 amountVested = uint256(daysVested.mul(amountVestedPerDay));
            return (daysVested, amountVested);
        }
    }

    function currentTime() private view returns (uint256) {
        return block.timestamp;
    }
}
