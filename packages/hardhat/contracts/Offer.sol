// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerkleDistributor.sol";
import "./VestingVault.sol";

contract Offer is Ownable, ERC721 {
    using SafeMath for uint64; // TODO check if we should use SafeMath64
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;
    VestingVault private _vestingVault;
    MerkleDistributor private _merkleDistributor;

    ERC20 public token;

    uint64 public upfrontVestingPct;
    uint16 public vestingDurationInDays;
    uint16 public vestingCliffInDays;

    uint265 public offerEnd;

    uint64 public constant PCT_BASE = 10**18; // 0% = 0; 1% = 10^16; 100% = 10^18

    event ClaimedOffer(uint256 tokenId, address account, uint256 amount);

    modifier onlyAfter(uint256 _time) {
        require(now > _time);
        _;
    }

    constructor(
        address token_,
        bytes32 merkleRoot_,
        uint64 upfrontVestingPct_,
        uint16 vestingDurationInDays_,
        uint16 vestingCliffInDays_,
        uint16 offerExpirationInDays_,
        string memory erc721TokenName_,
        string memory erc721Symbol_
    ) public ERC721(erc721Name_, erc721Symbol_) {
        token = ERC20(token_);
        _vestingVault = new VestingVault(token);
        _merkleDistributor = new MerkleDistributor(token_, merkleRoot_);

        upfrontVestingPct = upfrontVestingPct_;
        vestingDurationInDays = vestingDurationInDays_;
        vestingCliffInDays = vestingCliffInDays_;

        offerEnd = currentTime().add(offerExpirationInDays_ * 1 days).div(
            1 days
        );
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
        _vestingVault.addTokenGrant(
            newItemId,
            account,
            amount.mul(PCT_BASE.sub(upfrontVestingPct).div(PCT_BASE)),
            vestingDurationInDays,
            vestingCliffInDays
        );

        // Send upfront tokens.
        if (upfrontVestingPct != 0) {
            uint256 upfrontAmount = amount.mul(upfrontVestingPct).div(PCT_BASE);
            require(
                token.transfer(account, upfrontAmount),
                "Offer: Transfer failed."
            );
        }

        emit ClaimedOffer(newItemId, account, amount);
    }

    /// @notice Allows to claim the vested tokens of a grant with `tokenId`. Errors if no tokens have vested
    function claimVestedTokens(uint256 tokenId) external {
        _vestingVault.claimVestedTokens(tokenId);
    }

    /// @notice Withdraw all tokens from the Offer to the `recipient` address. Only allowed after the offer ends.
    function withdrawTokens(address recipient)
        external
        onlyAfter(offerEnd)
        onlyOwner
    {
        require(
            token.transfer(recipient, token.balanceOf(address(this))),
            "Offer: Transfer failed."
        );
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override {
        require(_vestingVault.getGrantRecipient(tokenId) == from);
        _vestingVault.transferTokenGrantRecipient(tokenId, to);
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override {
        require(_vestingVault.getGrantRecipient(tokenId) == from);
        _vestingVault.transferTokenGrantRecipient(tokenId, to);
        super.safeTransferFrom(from, to, tokenId, data);
    }
}
