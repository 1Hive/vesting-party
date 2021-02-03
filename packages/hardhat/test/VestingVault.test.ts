import { waffle, ethers, artifacts } from 'hardhat'
import { expect } from 'chai'
import { BigNumber, Signer } from 'ethers'
import { takeSnapshot, restoreSnapshot, increase, duration } from '../src/rpc'
import { TestERC20, TestVestingVault } from '../typechain'

const { deployContract } = waffle

const ERRORS = {
  OWNER: 'Ownable: caller is not the owner',
  NO_VEST: 'Vested is 0',
  VEST_AMOUNT: 'amountVestedPerPeriod > 0',
  ALLOWANCE: 'ERC20: transfer amount exceeds balance',
  GRANT_EXIST: 'Vesting already exists',
  FULLY_VESTED: 'Vesting fully claimed',
}

const EVENTS = {
  ADDED: 'VestingAdded',
  REVOKED: 'VestingRevoked',
  CLAIMED: 'VestingTokensClaimed',
  TRANSFERED: 'VestingBeneficiaryTransfered',
}

const overrides = {
  gasLimit: 9500000,
}

describe('VestingVault', () => {
  let token: TestERC20
  let vault: TestVestingVault

  let snapshotId

  let amount: BigNumber
  let owner: Signer, other: Signer
  let ownerAddress: string, otherAddress: string
  before(async function () {
    ;[owner, other] = await ethers.getSigners()
    ownerAddress = await owner.getAddress()
    otherAddress = await other.getAddress()

    amount = ethers.BigNumber.from('1000')
    token = (await deployContract(
      owner,
      await artifacts.readArtifact('TestERC20'),
      ['Token', 'TKN', amount],
      overrides
    )) as TestERC20
  })

  beforeEach(async () => {
    snapshotId = await takeSnapshot()
    await token.setBalance(ownerAddress, 0)
    await token.setBalance(otherAddress, 0)
    await token.setBalance(vault.address, amount)
  })

  afterEach(async () => {
    await restoreSnapshot(snapshotId)
  })

  describe('Vesting with periods in days, 10 duration, 2 cliff', () => {
    before(async function () {
      vault = (await deployContract(
        owner,
        await artifacts.readArtifact('TestVestingVault'),
        [token.address, 0, 10, 2],
        overrides
      )) as TestVestingVault
    })

    it('should only allow owner to grant', async function () {
      await expect(vault.connect(other)._addTokenVesting(0, otherAddress, 10)).to.be.revertedWith(ERRORS.OWNER)
    })

    it('should emit an event on grant', async function () {
      await expect(vault._addTokenVesting(0, otherAddress, 10)).to.emit(vault, EVENTS.ADDED).withArgs(0)
    })

    it('should emit an event on claim', async function () {
      await vault._addTokenVesting(0, otherAddress, 10)
      await increase(duration.days(3))
      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 3)
    })

    it('can get grant start time', async function () {
      await vault._addTokenVesting(0, otherAddress, 10)
      expect((await vault.getVestingStartTime(0)).toString()).to.equal(
        (await ethers.provider.getBlock('latest')).timestamp.toString()
      )
    })

    it('can get grant amount', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)
      expect((await vault.getVestingAmount(0)).toString()).to.equal('1000')
    })

    it('can get grant recipient', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)
      expect(await vault.getVestingBeneficiary(0)).to.equal(otherAddress)
    })

    it('can not add a grant if one already exists', async function () {
      await vault._addTokenVesting(0, otherAddress, 300)
      await expect(vault._addTokenVesting(0, otherAddress, 200)).to.be.revertedWith(ERRORS.GRANT_EXIST)
      expect((await vault.getVestingAmount(0)).toString()).to.equal('300')
    })

    it('can not claim unvested tokens', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)
      await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.NO_VEST)
    })

    it('should have an amount vesting per day greater than zero', async function () {
      await expect(vault._addTokenVesting(0, otherAddress, 9)).to.be.revertedWith(ERRORS.VEST_AMOUNT)
    })

    it('should have no vesting before cliff', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('0')

      await increase(duration.days(1))

      await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.NO_VEST)
    })

    it('can claim vested tokens', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('0')

      await increase(duration.days(2))

      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 200)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('200')
    })

    it('grants all tokens if over testing duration', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('0')

      await increase(duration.days(20))

      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 1000)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('1000')
    })

    it('transfer vesting recipient', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)

      await increase(duration.days(3))

      await expect(vault._transferVestingBeneficiary(0, ownerAddress)).to.emit(vault, EVENTS.TRANSFERED).withArgs(0)

      expect(await vault.getVestingBeneficiary(0)).to.equal(ownerAddress)

      expect((await token.balanceOf(ownerAddress)).toString()).to.equal('0')
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('300')
      expect((await token.balanceOf(vault.address)).toString()).to.equal('700')

      await increase(duration.days(2))

      await expect(vault.claimVestedTokens(0))
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('300')
      expect((await token.balanceOf(ownerAddress)).toString()).to.equal('200')
      expect((await token.balanceOf(vault.address)).toString()).to.equal('500')
    })
  })

  describe('Vesting with periods in days, 10 duration, no cliff', () => {
    before(async function () {
      vault = (await deployContract(
        owner,
        await artifacts.readArtifact('TestVestingVault'),
        [token.address, 0, 10, 0],
        overrides
      )) as TestVestingVault
      await token.approve(vault.address, 1000)
    })
  })

  describe('Vesting with periods in days, 5 duration, 3 cliff', () => {
    before(async function () {
      vault = (await deployContract(
        owner,
        await artifacts.readArtifact('TestVestingVault'),
        [token.address, 0, 5, 3],
        overrides
      )) as TestVestingVault
      await token.approve(vault.address, 1000)
    })

    it('does not release tokens before cliff is up', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)

      await increase(duration.days(1))
      await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.NO_VEST)

      await increase(duration.days(1))
      await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.NO_VEST)

      await increase(duration.days(1))
      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 600)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('600')

      await increase(duration.days(1))
      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 200)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('800')

      await increase(duration.days(1))
      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 200)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('1000')

      await increase(duration.days(1))
      await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.FULLY_VESTED)
    })
  })

  describe('Vesting with periods in days, 3 duration, no cliff', () => {
    before(async function () {
      vault = (await deployContract(
        owner,
        await artifacts.readArtifact('TestVestingVault'),
        [token.address, 0, 3, 0],
        overrides
      )) as TestVestingVault
      await token.approve(vault.address, 1000)
    })

    it('releases balance at end if uneven vest', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)

      await increase(duration.days(1))

      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 333)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('333')

      await increase(duration.days(1))

      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 333)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('666')

      await increase(duration.days(1))

      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 334)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('1000')

      await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.FULLY_VESTED)
    })
  })

  describe('Vesting with periods in days, 1 duration, no cliff', () => {
    before(async function () {
      vault = (await deployContract(
        owner,
        await artifacts.readArtifact('TestVestingVault'),
        [token.address, 0, 1, 0],
        overrides
      )) as TestVestingVault
      await token.approve(vault.address, 1000)
    })
    it('vests immediately if no cliff', async function () {
      await vault._addTokenVesting(0, otherAddress, 1000)

      await increase(duration.days(1))

      await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(0, 1000)
      expect((await token.balanceOf(otherAddress)).toString()).to.equal('1000')
      await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.FULLY_VESTED)
    })
  })
})
