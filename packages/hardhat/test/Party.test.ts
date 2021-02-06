import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import { ethers } from 'hardhat'
import { takeSnapshot, restoreSnapshot, increase, duration } from '../src/rpc'
import BalanceTree from '../src/balance-tree'
import { Party, Party__factory, TestERC20, TestERC20__factory } from '../typechain'

const ERRORS = {
  INVALID_PROOF: 'MerkleDistributor: Invalid proof.',
  NO_VEST: 'Vested is 0',
  NOT_OWNER: 'Ownable: caller is not the owner',
  ALREADY_CLAIMED: 'MerkleDistributor: Drop already claimed.',
  ERC721_NOT_EXIST: 'ERC721: owner query for nonexistent token',
}

const EVENTS = {
  PARTY_JOINED: 'PartyJoined',
  TOKENS_CLAIMED: 'VestingTokensClaimed',
  TRANSFER: 'Transfer',
}

const PCT_20 = `20${'00'.repeat(8)}`

const PCT_BASE = `100${'00'.repeat(8)}`

const PCT_BASE_PLUS_ONE = `101${'00'.repeat(8)}`

const overrides = {
  gasLimit: 9500000,
}

describe('Party', function () {
  let signers: Signer[], wallet0: string, wallet1: string

  let snapshotId

  let token: TestERC20
  let party: Party
  let tree: BalanceTree

  before(async () => {
    signers = await ethers.getSigners()
    wallet0 = await signers[0].getAddress()
    wallet1 = await signers[1].getAddress()

    const TestERC20 = (await ethers.getContractFactory('TestERC20')) as TestERC20__factory
    token = await TestERC20.deploy('Token', 'TKN', 0, overrides)
  })

  beforeEach(async () => {
    snapshotId = await takeSnapshot()
  })

  afterEach(async () => {
    await restoreSnapshot(snapshotId)
  })

  describe('deploy Party', function () {
    it('should revert if upfront amount more than whole', async () => {
      tree = new BalanceTree([
        { account: wallet0, amount: BigNumber.from(100) },
        { account: wallet1, amount: BigNumber.from(200) },
      ])
      const Party = (await ethers.getContractFactory('Party')) as Party__factory
      await expect(Party.deploy(token.address, tree.getHexRoot(), PCT_BASE_PLUS_ONE, 0, 10, 2)).to.be.reverted
    })
  })

  describe('Party config #1', function () {
    beforeEach('deploy', async () => {
      tree = new BalanceTree([
        { account: wallet0, amount: BigNumber.from(100) },
        { account: wallet1, amount: BigNumber.from(200) },
      ])
      const Party = (await ethers.getContractFactory('Party')) as Party__factory
      party = (await Party.deploy(token.address, tree.getHexRoot(), 0, 0, 10, 2)) as Party
      await token.setBalance(party.address, 300)
    })

    it('should generate the right name and symbol', async () => {
      expect(await party.name()).to.equal('Vested ' + (await token.name()))
      expect(await party.symbol()).to.equal('v' + (await token.symbol()))
    })

    describe('#claimParty', () => {
      it('should mint an erc721 to account', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        expect(await party.getVestingBeneficiary(1)).to.equal(wallet0)
        expect(await party.getVestingAmount(1)).to.equal(BigNumber.from(100))
        expect(await party.ownerOf(1)).to.equal(wallet0)
      })

      it('should add vesting correctly', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        expect(await party.getVestingAmount(1)).to.equal(100)
        expect(await party.getVestingBeneficiary(1)).to.equal(wallet0)
        expect(await party.getVestingStartTime(1)).to.equal(
          (await ethers.provider.getBlock('latest')).timestamp.toString()
        )
      })

      it('should not upfront vested tokens', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        expect((await token.balanceOf(wallet0)).toString()).to.equal('0')
      })

      it('should not sent vested tokens before cliff', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        await increase(duration.days(1))

        await expect(party.claimVestedTokens(1)).to.be.revertedWith(ERRORS.NO_VEST)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('0')
      })

      it('should not allow to claim twice', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0)).to.be.revertedWith(
          ERRORS.ALREADY_CLAIMED
        )
      })

      it('should vest all tokens after vesting end', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        await increase(duration.days(11))

        await expect(party.claimVestedTokens(1)).to.emit(party, EVENTS.TOKENS_CLAIMED).withArgs(1, 100)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('100')
      })
    })
  })

  describe('Party config #2', function () {
    beforeEach('deploy', async () => {
      tree = new BalanceTree([
        { account: wallet0, amount: BigNumber.from(100) },
        { account: wallet1, amount: BigNumber.from(200) },
      ])
      const Party = (await ethers.getContractFactory('Party')) as Party__factory
      party = (await Party.deploy(token.address, tree.getHexRoot(), PCT_20, 2, 10, 2)) as Party
      await token.setBalance(party.address, 300)
    })

    describe('#claimParty', () => {
      it('should upfront 20% of tokens', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        expect(await party.getVestingBeneficiary(1)).to.equal(wallet0)
        expect(await party.getVestingAmount(1)).to.equal(80)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')
      })
    })

    describe('#claimVestedTokens', () => {
      it('should vest tokens correctly', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')

        await increase(duration.weeks(10))

        await expect(party.claimVestedTokens(1)).to.emit(party, EVENTS.TOKENS_CLAIMED).withArgs(1, 16)

        expect(await party.getVestingBeneficiary(1)).to.equal(wallet0)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('36')
      })
    })

    describe('#transferFrom', () => {
      it('should update vesting recipient on transfer', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))
        expect(await party.ownerOf(1)).to.equal(wallet0)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')

        await increase(duration.weeks(10))

        await expect(party.transferFrom(wallet0, wallet1, 1))
          .to.emit(party, EVENTS.TRANSFER)
          .withArgs(wallet0, wallet1, 1)

        expect(await party.ownerOf(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('36')
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')

        await increase(duration.weeks(10))

        await expect(party.claimVestedTokens(1)).to.emit(party, EVENTS.TOKENS_CLAIMED).withArgs(1, 16)

        expect(await party.getVestingBeneficiary(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('16')
      })
    })

    describe('#safeTransferFrom', () => {
      it('should update vesting recipient on transfer', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))
        expect(await party.ownerOf(1)).to.equal(wallet0)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')

        await increase(duration.weeks(10))

        await expect(party['safeTransferFrom(address,address,uint256)'](wallet0, wallet1, 1))
          .to.emit(party, EVENTS.TRANSFER)
          .withArgs(wallet0, wallet1, 1)

        expect(await party.ownerOf(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('36')
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')

        await increase(duration.weeks(10))

        await expect(party.claimVestedTokens(1)).to.emit(party, EVENTS.TOKENS_CLAIMED).withArgs(1, 16)

        expect(await party.getVestingBeneficiary(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('16')
      })

      it('should update vesting recipient on transfer with data', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))
        expect(await party.ownerOf(1)).to.equal(wallet0)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')

        await increase(duration.weeks(10))

        await expect(party['safeTransferFrom(address,address,uint256,bytes)'](wallet0, wallet1, 1, '0x'))
          .to.emit(party, EVENTS.TRANSFER)
          .withArgs(wallet0, wallet1, 1)

        expect(await party.ownerOf(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('36')
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')

        await increase(duration.weeks(10))

        await expect(party.claimVestedTokens(1)).to.emit(party, EVENTS.TOKENS_CLAIMED).withArgs(1, 16)

        expect(await party.getVestingBeneficiary(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('16')
      })
    })
  })

  describe('Party config #3', function () {
    let currentTokenId

    beforeEach('deploy', async () => {
      tree = new BalanceTree([
        { account: wallet0, amount: BigNumber.from(100) },
        { account: wallet1, amount: BigNumber.from(200) },
      ])
      const Party = (await ethers.getContractFactory('Party')) as Party__factory
      party = (await Party.deploy(token.address, tree.getHexRoot(), PCT_BASE, 2, 10, 2)) as Party
      currentTokenId = 0
      await token.setBalance(party.address, 300)
    })

    describe('#claimParty', () => {
      it('should upfront 100% of tokens', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        expect(await party.getVestingAmount(1)).to.equal(0)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('100')
      })
      it('should not mint a token', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        await expect(party.ownerOf(currentTokenId + 1)).to.be.revertedWith(ERRORS.ERC721_NOT_EXIST)
      })

      it('should not add a vesting', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(party.joinParty(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(party, EVENTS.PARTY_JOINED)
          .withArgs(wallet0, BigNumber.from(100))

        expect(await party.getVestingBeneficiary(currentTokenId + 1)).to.equal(ethers.constants.AddressZero)
      })
    })
  })
})
