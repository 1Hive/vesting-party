import { waffle, ethers, artifacts } from 'hardhat'
import { expect } from 'chai'
import { Signer } from 'ethers'
import { takeSnapshot, restoreSnapshot, increase, duration } from '../src/rpc'
import { TestERC20, VestingVault } from '../typechain'

const { deployContract } = waffle

const ERRORS = {
  OWNER: 'Ownable: caller is not the owner',
  NO_VEST: 'Vested is 0',
  VEST_DURATION: 'Token cliff longer than duration',
  VEST_AMOUNT: 'amountVestedPerDay > 0',
  ALLOWANCE: 'ERC20: transfer amount exceeds balance',
  GRANT_EXIST: 'Grant already exists',
  FULLY_VESTED: 'Grant fully claimed',
}

const EVENTS = {
  ADDED: 'GrantAdded',
  REVOKED: 'GrantRevoked',
  CLAIMED: 'GrantTokensClaimed',
  TRANSFERED: 'GrantTransfered',
}

const overrides = {
  gasLimit: 9500000,
}

describe('VestingVault', () => {
  let token: TestERC20
  let vault: VestingVault

  let snapshotId
  let owner: Signer, other: Signer
  let ownerAddress: string, otherAddress: string
  beforeEach(async function () {
    snapshotId = await takeSnapshot()
    ;[owner, other] = await ethers.getSigners()
    ownerAddress = await owner.getAddress()
    otherAddress = await other.getAddress()

    const amount = ethers.BigNumber.from('1000')
    token = (await deployContract(
      owner,
      await artifacts.readArtifact('TestERC20'),
      ['Token', 'TKN', amount],
      overrides
    )) as TestERC20
    await token.setBalance(await owner.getAddress(), amount)

    vault = (await deployContract(
      owner,
      await artifacts.readArtifact('VestingVault'),
      [token.address],
      overrides
    )) as VestingVault
    await token.approve(vault.address, 1000)
  })

  afterEach(async () => {
    await restoreSnapshot(snapshotId)
  })

  it('should only allow owner to grant', async function () {
    await expect(vault.connect(other).addTokenGrant(0, otherAddress, 10, 0, 10, 2)).to.be.revertedWith(ERRORS.OWNER)
  })

  it('should only allow owner to revoke', async function () {
    await vault.addTokenGrant(0, otherAddress, 10, 0, 10, 0)

    await expect(vault.connect(other).revokeTokenGrant(0)).to.be.revertedWith(ERRORS.OWNER)
  })

  it('should emit an event on grant', async function () {
    await expect(vault.addTokenGrant(0, otherAddress, 10, 0, 10, 2))
      .to.emit(vault, EVENTS.ADDED)
      .withArgs(0, otherAddress, 10, 10, 2)
  })

  it('should emit an event on revoke', async function () {
    await vault.addTokenGrant(0, otherAddress, 10, 0, 10, 0)

    await expect(vault.revokeTokenGrant(0)).to.emit(vault, EVENTS.REVOKED).withArgs(0, otherAddress, 0, 10)
  })

  it('should emit an event on claim', async function () {
    await vault.addTokenGrant(0, otherAddress, 10, 0, 10, 0)

    await increase(duration.days(1))

    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 1)
  })

  it('should have an vesting duration greater than cliff', async function () {
    await expect(vault.addTokenGrant(0, otherAddress, 10, 0, 900, 1000)).to.be.revertedWith(ERRORS.VEST_DURATION)
  })

  it('should have an amount vesting per day greater than zero', async function () {
    await expect(vault.addTokenGrant(0, otherAddress, 10, 0, 1001, 1000)).to.be.revertedWith(ERRORS.VEST_AMOUNT)
  })

  it('should reject transfer outside of allowance', async function () {
    await expect(vault.addTokenGrant(0, otherAddress, 1001, 0, 10, 0)).to.be.revertedWith(ERRORS.ALLOWANCE)
  })

  it('can get grant start time', async function () {
    await vault.addTokenGrant(0, otherAddress, 10, 0, 10, 0)

    expect((await vault.getGrantStartTime(0)).toString()).to.equal(
      (await ethers.provider.getBlock('latest')).timestamp.toString()
    )
  })

  it('can get grant amount', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 10, 1)
    expect((await vault.getGrantAmount(0)).toString()).to.equal('1000')
  })

  it('can get grant recipient', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 10, 1)
    expect(await vault.getGrantRecipient(0)).to.equal(otherAddress)
  })

  it('can not add a grant if one already exists', async function () {
    await vault.addTokenGrant(0, otherAddress, 300, 0, 10, 1)
    await expect(vault.addTokenGrant(0, otherAddress, 200, 0, 10, 1)).to.be.revertedWith(ERRORS.GRANT_EXIST)
    expect((await vault.getGrantAmount(0)).toString()).to.equal('300')
  })

  it('can not claim unvested tokens', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 10, 1)
    await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.NO_VEST)
  })

  it('can claim vested tokens', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 10, 0)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('0')

    await increase(duration.days(2))

    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 200)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('200')
  })

  it('grants all tokens if over testing duration', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 10, 0)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('0')

    await increase(duration.days(20))

    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 1000)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('1000')
  })

  it('transfer vesting recipient', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 10, 0)

    await increase(duration.days(3))

    await expect(vault.transferTokenGrantRecipient(0, ownerAddress))
      .to.emit(vault, EVENTS.TRANSFERED)
      .withArgs(ownerAddress)

    expect((await token.balanceOf(ownerAddress)).toString()).to.equal('0')
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('300')
    expect((await token.balanceOf(vault.address)).toString()).to.equal('700')

    await increase(duration.days(2))

    await expect(vault.claimVestedTokens(0))
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('300')
    expect((await token.balanceOf(ownerAddress)).toString()).to.equal('200')
    expect((await token.balanceOf(vault.address)).toString()).to.equal('500')
  })

  it('vests immediately if no cliff', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 1, 0)

    await increase(duration.days(1))

    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 1000)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('1000')
    await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.FULLY_VESTED)
  })

  it('does not release tokens before cliff is up', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 5, 3)

    await increase(duration.days(1))
    await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.NO_VEST)

    await increase(duration.days(1))
    await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.NO_VEST)

    await increase(duration.days(1))
    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 600)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('600')

    await increase(duration.days(1))
    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 200)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('800')

    await increase(duration.days(1))
    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 200)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('1000')

    await increase(duration.days(1))
    await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.FULLY_VESTED)
  })

  it('releases balance at end if uneven vest', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 3, 0)

    await increase(duration.days(1))

    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 333)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('333')

    await increase(duration.days(1))

    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 333)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('666')

    await increase(duration.days(1))

    await expect(vault.claimVestedTokens(0)).to.emit(vault, EVENTS.CLAIMED).withArgs(otherAddress, 334)
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('1000')

    await expect(vault.claimVestedTokens(0)).to.be.revertedWith(ERRORS.FULLY_VESTED)
  })

  it('owner can revoke token grant', async function () {
    await vault.addTokenGrant(0, otherAddress, 1000, 0, 5, 0)
    expect((await token.balanceOf(vault.address)).toString()).to.equal('1000')

    await increase(duration.days(3))

    // Revoke claim vested tokens for the elapsed days
    await vault.revokeTokenGrant(0)
    expect((await token.balanceOf(ownerAddress)).toString()).to.equal('400')
    expect((await token.balanceOf(otherAddress)).toString()).to.equal('600')
    expect((await token.balanceOf(vault.address)).toString()).to.equal('0')
  })
})
