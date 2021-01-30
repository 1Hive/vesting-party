// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.6.11;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "./interfaces/IMerkleDistributor.sol";
import "./VestingVault.sol";

contract Offer is ERC721, IMerkleDistributor {
    using SafeMath64 for uint64;
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIds;

    VestingVault private vestingVault;

    address public immutable override token;
    bytes32 public immutable override merkleRoot;

    uint64 public immutable override upfrontVestingPct;
    uint16 public immutable override vestingDurationInDay;
    uint16 public immutable override vestingCliffInDays;

    // This is a packed array of booleans.
    mapping(uint256 => uint256) private claimedBitMap;

    constructor(address erc20Token_, bytes32 merkleRoot_, uint64 upfrontVestingPct_, uint16 vestingDurationInDays_, uint16 vestingCliffInDays_, string memory erc721Name_, string memory erc721Symbol_) ERC721(erc721Name_, erc721Symbol_) public {
        token = erc20Token_;
        merkleRoot = merkleRoot_;

        VestingVault vestingVault = new VestingVault(erc20Token_);

        upfrontVestingPct = upfrontVestingPct_;
        vestingDurationInDay = vestingDurationInDays_;
        vestingCliffInDays = vestingCliffInDays_;
    }

    function isClaimed(uint256 index) public view override returns (bool) {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        uint256 claimedWord = claimedBitMap[claimedWordIndex];
        uint256 mask = (1 << claimedBitIndex);
        return claimedWord & mask == mask;
    }

    function _setClaimed(uint256 index) private {
        uint256 claimedWordIndex = index / 256;
        uint256 claimedBitIndex = index % 256;
        claimedBitMap[claimedWordIndex] = claimedBitMap[claimedWordIndex] | (1 << claimedBitIndex);
    }

    function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external override {
        require(!isClaimed(index), 'MerkleDistributor: Drop already claimed.');

        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(index, account, amount));
        require(MerkleProof.verify(merkleProof, merkleRoot, node), 'MerkleDistributor: Invalid proof.');

        // Mark it claimed.
        _setClaimed(index);

        // Send upfront tokens.
        if (upfrontVestingPct != 0){
            require(IERC20(token).transfer(account, amount.mul(upfrontVestingPct)), 'MerkleDistributor: Transfer failed.');
        }

        // Mint vesting token NFT
        _tokenIds.increment();
        uint256 newItemId = _tokenIds.current();
        _safeMint(account, newItemId);

        // Grant vesting tokens.
        vestingVault.addTokenGrant(newItemId, account, amount.mul(1.sub(upfrontVestingPct)), vestingDurationInDays, vestingCliffInDays);

        emit Claimed(index, account, amount);
    }

    function transferFrom(address from, address to, uint256 tokenId) public override {
        require(vestingVault.getGrantRecipient(tokenId) == from);
        vestingVault.transferTokenGrantRecipient(tokenId, to);
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public override {
        require(vestingVault.getGrantRecipient(tokenId) == from);
        vestingVault.transferTokenGrantRecipient(tokenId, to);
        super.safeTransferFrom(from, to, tokenId, data);
    }

    /// @notice Allows to claim the vested tokens of a grant with `tokenId`. Errors if no tokens have vested
    function claimVestedTokens(uint256 tokenId) external {
        vestingVault.claimVestedTokens(tokenId);
    }

}
