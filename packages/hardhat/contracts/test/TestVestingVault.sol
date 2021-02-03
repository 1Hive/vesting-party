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

contract TestVestingVault is Ownable {
    using SafeMath for uint256;
    using SafeMath for uint16;

    uint256 internal constant ONE_MONTH = 2628000;
    uint256[3] internal periodUnits = [1 days, 1 weeks, ONE_MONTH];

    uint256 public vestingPeriod;
    uint16 public vestingDuration;
    uint16 public vestingCliff;

    ERC20 public token;

    struct Vesting {
        address beneficiary;
        uint256 amount;
        uint256 startTime;
        uint16 periodsClaimed;
        uint256 amountClaimed;
    }

    event VestingAdded(uint256 indexed tokenId);
    event VestingRevoked(
        uint256 indexed tokenId,
        address beneficiary,
        uint256 amountVested
    );
    event VestingTokensClaimed(uint256 indexed tokenId, uint256 amountVested);
    event VestingBeneficiaryTransfered(uint256 indexed tokenId);

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
        tokenVesting.amountClaimed = uint256(
            tokenVesting.amountClaimed.add(amountVested)
        );

        require(
            token.transfer(tokenVesting.beneficiary, amountVested),
            "no tokens"
        );
        emit VestingTokensClaimed(_tokenId, amountVested);
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

    function getVestingBeneficiary(uint256 _tokenId)
        public
        view
        returns (address)
    {
        Vesting storage tokenVesting = tokenVestings[_tokenId];
        return tokenVesting.beneficiary;
    }

    function getVestingAmountClaimed(uint256 _tokenId)
        public
        view
        returns (uint256)
    {
        Vesting storage tokenVesting = tokenVestings[_tokenId];
        return tokenVesting.amountClaimed;
    }

    function getVestingPeriodsClaimed(uint256 _tokenId)
        public
        view
        returns (uint16)
    {
        Vesting storage tokenVesting = tokenVestings[_tokenId];
        return tokenVesting.periodsClaimed;
    }

    /// @notice Add a new token grant for an erc721 token with `_tokenId`.
    /// The amount of tokens here need to be preapproved for transfer by this `Vesting` contract before this call
    /// @param _tokenId Vesting unique erc721 token id
    /// @param _beneficiary Address of the token grant beneficiary entitled to claim the grant funds
    /// @param _amount Total number of tokens in
    function _addTokenVesting(
        uint256 _tokenId,
        address _beneficiary,
        uint256 _amount
    ) public onlyOwner {
        require(tokenVestings[_tokenId].amount == 0, "Vesting already exists");
        uint256 amountVestedPerPeriod = _amount.div(uint256(vestingDuration));
        require(amountVestedPerPeriod > 0, "amountVestedPerPeriod > 0");

        Vesting memory vesting =
            Vesting({
                beneficiary: _beneficiary,
                startTime: currentTime(),
                amount: _amount,
                periodsClaimed: 0,
                amountClaimed: 0
            });

        tokenVestings[_tokenId] = vesting;
        emit VestingAdded(_tokenId);
    }

    /// @notice Transfer the beneficiary of a token grant with `_tokenId`
    function _transferVestingBeneficiary(uint256 _tokenId, address _beneficiary)
        public
        onlyOwner
    {
        claimVestedTokens(_tokenId);

        Vesting storage tokenVesting = tokenVestings[_tokenId];
        tokenVesting.beneficiary = _beneficiary;

        emit VestingBeneficiaryTransfered(_tokenId);
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
            tokenVesting.amountClaimed < tokenVesting.amount,
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
                tokenVesting.amount.sub(tokenVesting.amountClaimed);
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
