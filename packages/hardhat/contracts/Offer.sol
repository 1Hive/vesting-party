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

contract Offer is Ownable, VestingVault, ERC721 {
    using SafeMath for uint256;
    using SafeMath for uint64;
    using SafeMath for uint16;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;
    MerkleDistributor private _merkleDistributor;

    uint64 public constant PCT_BASE = 10**18; // 0% = 0; 1% = 10^16; 100% = 10^18

    uint64 public upfrontVestingPct;
    uint256 public offerEnd;

    event OfferClaimed(uint256 tokenId, address account, uint256 amount);

    modifier onlyAfter(uint256 _time) {
        require(now > _time, "Offer: duration not reach.");
        _;
    }

    constructor(
        address _token,
        bytes32 _merkleRoot,
        uint256 _offerDuration,
        uint64 _upfrontVestingPct,
        uint8 _vestingPeriodUnit,
        uint16 _vestingDurationInPeriods,
        uint16 _vestingCliffInPeriods,
        string memory _erc721Name,
        string memory _erc721Symbol
    )
        public
        VestingVault(
            _token,
            _vestingPeriodUnit,
            _vestingDurationInPeriods,
            _vestingCliffInPeriods
        )
        ERC721(_erc721Name, _erc721Symbol)
    {
        upfrontVestingPct = _upfrontVestingPct;

        offerEnd = _offerDuration.add(now);

        _merkleDistributor = new MerkleDistributor(address(token), _merkleRoot);
    }

    function claimOffer(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        // Here we do the proof verification and revert if account can't claim
        _merkleDistributor.claim(index, account, amount, merkleProof);

        // Mint erc721 token.
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(account, newItemId);

        // Grant vesting tokens.
        _addTokenVesting(
            newItemId,
            account,
            uint256(amount.mul(PCT_BASE.sub(upfrontVestingPct)).div(PCT_BASE))
        );

        // Send upfront tokens.
        if (upfrontVestingPct != 0) {
            require(
                token.transfer(
                    account,
                    uint256(amount.mul(upfrontVestingPct).div(PCT_BASE))
                ),
                "Offer: Transfer failed."
            );
        }

        emit OfferClaimed(newItemId, account, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        require(getVestingRecipient(tokenId) == from);

        _transferVestingRecipient(tokenId, to);

        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override {
        require(getVestingRecipient(tokenId) == from);

        _transferVestingRecipient(tokenId, to);

        super.safeTransferFrom(from, to, tokenId, data);
    }

    /// @notice Withdraw all tokens from the Offer to the `recipient` address. Only allowed after the offer ends.
    function withdrawTokens(address recipient)
        external
        onlyOwner
        onlyAfter(offerEnd)
    {
        require(
            token.transfer(recipient, token.balanceOf(address(this))),
            "Offer: Transfer failed."
        );
    }
}
