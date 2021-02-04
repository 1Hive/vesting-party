// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerkleDistributor.sol";
import "./VestingVault.sol";

import "hardhat/console.sol";

contract Party is Ownable, VestingVault, ERC721 {
    using SafeMath for uint256;
    using SafeMath for uint64;
    using SafeMath for uint16;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;

    MerkleDistributor public merkleDistributor;

    uint64 public constant PCT_BASE = 10**18; // 0% = 0; 1% = 10^16; 100% = 10^18

    bytes32 public merkleRoot;
    uint64 public upfrontVestingPct;
    uint256 public partyEnd;

    event PartyJoined(uint256 indexed tokenId);

    modifier onlyAfter(uint256 _time) {
        require(now > _time, "Party: duration not reach.");
        _;
    }

    constructor(
        address _token,
        bytes32 _merkleRoot,
        uint256 _partyDuration,
        uint64 _upfrontVestingPct,
        uint8 _vestingPeriodUnit,
        uint16 _vestingDurationInPeriods,
        uint16 _vestingCliffInPeriods
    )
        public
        VestingVault(
            _token,
            _vestingPeriodUnit,
            _vestingDurationInPeriods,
            _vestingCliffInPeriods
        )
        ERC721(
            string(abi.encodePacked("Vested ", ERC20(_token).name())),
            string(abi.encodePacked("v", ERC20(_token).symbol()))
        )
    {
        upfrontVestingPct = _upfrontVestingPct;
        partyEnd = _partyDuration.add(now);
        merkleRoot = _merkleRoot;
        merkleDistributor = new MerkleDistributor(address(token), _merkleRoot);
    }

    function joinParty(
        uint256 index,
        address beneficiary,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        // Here we do the proof verification and revert if beneficiary can't claim
        merkleDistributor.claim(index, beneficiary, amount, merkleProof);

        // Mint erc721 token.
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(beneficiary, newItemId);

        // Grant vesting tokens.
        _addTokenVesting(
            newItemId,
            beneficiary,
            uint256(amount.mul(PCT_BASE.sub(upfrontVestingPct)).div(PCT_BASE))
        );

        // Send upfront tokens.
        if (upfrontVestingPct != 0) {
            require(
                token.transfer(
                    beneficiary,
                    uint256(amount.mul(upfrontVestingPct).div(PCT_BASE))
                ),
                "Party: Transfer failed."
            );
        }

        emit PartyJoined(newItemId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        require(getVestingBeneficiary(tokenId) == from);

        _transferVestingBeneficiary(tokenId, to);

        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override {
        require(getVestingBeneficiary(tokenId) == from);

        _transferVestingBeneficiary(tokenId, to);

        super.safeTransferFrom(from, to, tokenId, data);
    }

    /// @notice Withdraw all tokens from the Party to the `recipient` address. Only allowed after the offer ends.
    function withdrawTokens(address recipient)
        external
        onlyOwner
        onlyAfter(partyEnd)
    {
        require(
            token.transfer(recipient, token.balanceOf(address(this))),
            "Party: Transfer failed."
        );
    }
}
