// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.6.11;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./MerkleDistributor.sol";
import "./VestingVault.sol";

contract Offer is ERC721 {
    using SafeMath64 for uint64;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;
    VestingVault private _vestingVault;
    MerkleDistributor private _merkleDistributor;

    uint64 public immutable override upfrontVestingPct;
    uint16 public immutable override vestingDurationInDay;
    uint16 public immutable override vestingCliffInDays;

    uint64 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10^16; 100% = 10^18

    event ClaimedOffer(uint256 tokenId, address account, uint256 amount);

    constructor(
        address erc20Token_,
        bytes32 merkleRoot_,
        uint64 upfrontVestingPct_,
        uint16 vestingDurationInDays_,
        uint16 vestingCliffInDays_,
        string memory erc721Name_,
        string memory erc721Symbol_
    ) public ERC721(erc721Name_, erc721Symbol_) {
        _vestingVault = new VestingVault(erc20Token_);
        _merkleDistributor = new MerkleDistributor(erc20Token_, merkleRoot_);

        upfrontVestingPct = upfrontVestingPct_;
        vestingDurationInDay = vestingDurationInDays_;
        vestingCliffInDays = vestingCliffInDays_;
    }

    function claimOffer(
        uint256 index,
        address account,
        uint256 amount,
        bytes32[] calldata merkleProof
    ) external {
        _merkleDistributor.claim(index, account, amount, merkleProof);

        // Send upfront tokens.
        if (upfrontVestingPct != 0) {
            require(
                IERC20(token).transfer(account, amount.mul(upfrontVestingPct)),
                "Offer: Transfer failed."
            );
        }

        // Mint erc721 token.
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(account, newItemId);

        // Grant vesting tokens.
        _vestingVault.addTokenGrant(
            newItemId,
            account,
            0, // hardcode startTime for now
            amount.mul(PCT_BASE.sub(upfrontVestingPct)),
            vestingDurationInDays,
            vestingCliffInDays
        );

        emit ClaimedOffer(newItemId, account, amount);
    }

    /// @notice Allows to claim the vested tokens of a grant with `tokenId`. Errors if no tokens have vested
    function claimVestedTokens(uint256 tokenId) external {
        _vestingVault.claimVestedTokens(tokenId);
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
