import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import { ethers } from 'hardhat'
import { takeSnapshot, restoreSnapshot, increase, duration } from '../src/rpc'
import BalanceTree from '../src/balance-tree'
import { Offer, Offer__factory, TestERC20, TestERC20__factory } from '../typechain'

const ERRORS = {
  INVALID_PROOF: 'MerkleDistributor: Invalid proof.',
  RUNNING: 'Offer: duration not reach.',
  NOT_OWNER: 'Ownable: caller is not the owner',
  ALREADY_CLAIMED: 'MerkleDistributor: Drop already claimed.',
}

const EVENTS = {
  OFFER_CLAIMED: 'OfferClaimed',
  TOKENS_CLAIMED: 'VestingTokensClaimed',
  TRANSFER: 'Transfer',
}

const PCT_20 = `20${'00'.repeat(8)}`

const ONE_YEAR = duration.years(1)

const overrides = {
  gasLimit: 9500000,
}

describe('Offer', function () {
  let signers: Signer[], wallet0: string, wallet1: string

  let snapshotId

  let token: TestERC20
  let offer: Offer
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

  describe('Offer config #1', function () {
    beforeEach('deploy', async () => {
      tree = new BalanceTree([
        { account: wallet0, amount: BigNumber.from(100) },
        { account: wallet1, amount: BigNumber.from(200) },
      ])
      const Offer = (await ethers.getContractFactory('Offer')) as Offer__factory
      offer = (await Offer.deploy(token.address, tree.getHexRoot(), ONE_YEAR, 0, 0, 10, 2, 'Vesting', 'VST')) as Offer
      await token.setBalance(offer.address, 300)
    })

    describe('#claimOffer', () => {
      it('should mint an erc721 to account', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)

        expect(await offer.getVestingBeneficiary(1)).to.equal(wallet0)
        expect(await offer.getVestingAmount(1)).to.equal(BigNumber.from(100))
        expect(await offer.ownerOf(1)).to.equal(wallet0)
      })

      it('should add vesting correctly', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)

        expect(await offer.getVestingAmount(1)).to.equal(100)
        expect(await offer.getVestingBeneficiary(1)).to.equal(wallet0)
        expect(await offer.getVestingStartTime(1)).to.equal(
          (await ethers.provider.getBlock('latest')).timestamp.toString()
        )
      })

      it('should not upfront vested tokens', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)

        expect((await token.balanceOf(wallet0)).toString()).to.equal('0')
      })

      it('should not allow to claim twice', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)

        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0)).to.be.revertedWith(
          ERRORS.ALREADY_CLAIMED
        )
      })
    })

    describe('#withdrawTokens', () => {
      it('should not allow withdraw tokens before offerEnd', async () => {
        await expect(offer.withdrawTokens(wallet0)).to.be.reverted
      })
      it('should not allow allow other account to withdraw', async () => {
        await increase(duration.years(2))
        await expect(offer.connect(signers[1]).withdrawTokens(wallet0)).to.be.revertedWith(ERRORS.NOT_OWNER)
      })

      it('should allow withdraw tokens after offerEnd', async () => {
        await increase(duration.years(2))
        await offer.withdrawTokens(wallet0)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('300')
      })
    })
  })

  describe('Offer config #2', function () {
    beforeEach('deploy', async () => {
      tree = new BalanceTree([
        { account: wallet0, amount: BigNumber.from(100) },
        { account: wallet1, amount: BigNumber.from(200) },
      ])
      const Offer = (await ethers.getContractFactory('Offer')) as Offer__factory
      offer = (await Offer.deploy(
        token.address,
        tree.getHexRoot(),
        ONE_YEAR,
        PCT_20,
        2,
        10,
        2,
        'Vesting',
        'VST'
      )) as Offer
      await token.setBalance(offer.address, 300)
    })

    describe('#claimOffer', () => {
      it('should upfront 20% of tokens', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)

        expect(await offer.getVestingBeneficiary(1)).to.equal(wallet0)
        expect(await offer.getVestingAmount(1)).to.equal(80)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')
      })
    })

    describe('#claimVestedTokens', () => {
      it('should vest tokens correctly', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')

        await increase(duration.weeks(10))

        await expect(offer.claimVestedTokens(1)).to.emit(offer, EVENTS.TOKENS_CLAIMED).withArgs(1, 16)

        expect(await offer.getVestingBeneficiary(1)).to.equal(wallet0)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('36')
      })
    })

    describe('#transferFrom', () => {
      it('should update vesting recipient on transfer', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)
        expect(await offer.ownerOf(1)).to.equal(wallet0)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')

        await increase(duration.weeks(10))

        await expect(offer.transferFrom(wallet0, wallet1, 1))
          .to.emit(offer, EVENTS.TRANSFER)
          .withArgs(wallet0, wallet1, 1)

        expect(await offer.ownerOf(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('36')
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')

        await increase(duration.weeks(10))

        await expect(offer.claimVestedTokens(1)).to.emit(offer, EVENTS.TOKENS_CLAIMED).withArgs(1, 16)

        expect(await offer.getVestingBeneficiary(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('16')
      })
    })

    describe('#safeTransferFrom', () => {
      it('should update vesting recipient on transfer', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)
        expect(await offer.ownerOf(1)).to.equal(wallet0)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')

        await increase(duration.weeks(10))

        await expect(offer['safeTransferFrom(address,address,uint256)'](wallet0, wallet1, 1))
          .to.emit(offer, EVENTS.TRANSFER)
          .withArgs(wallet0, wallet1, 1)

        expect(await offer.ownerOf(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('36')
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')

        await increase(duration.weeks(10))

        await expect(offer.claimVestedTokens(1)).to.emit(offer, EVENTS.TOKENS_CLAIMED).withArgs(1, 16)

        expect(await offer.getVestingBeneficiary(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('16')
      })

      it('should update vesting recipient on transfer with data', async () => {
        const proof0 = tree.getProof(0, wallet0, BigNumber.from(100))
        await expect(offer.claimOffer(0, wallet0, BigNumber.from(100), proof0))
          .to.emit(offer, EVENTS.OFFER_CLAIMED)
          .withArgs(1)
        expect(await offer.ownerOf(1)).to.equal(wallet0)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')
        expect((await token.balanceOf(wallet0)).toString()).to.equal('20')

        await increase(duration.weeks(10))

        await expect(offer['safeTransferFrom(address,address,uint256,bytes)'](wallet0, wallet1, 1, '0x'))
          .to.emit(offer, EVENTS.TRANSFER)
          .withArgs(wallet0, wallet1, 1)

        expect(await offer.ownerOf(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet0)).toString()).to.equal('36')
        expect((await token.balanceOf(wallet1)).toString()).to.equal('0')

        await increase(duration.weeks(10))

        await expect(offer.claimVestedTokens(1)).to.emit(offer, EVENTS.TOKENS_CLAIMED).withArgs(1, 16)

        expect(await offer.getVestingBeneficiary(1)).to.equal(wallet1)
        expect((await token.balanceOf(wallet1)).toString()).to.equal('16')
      })
    })
  })
})
