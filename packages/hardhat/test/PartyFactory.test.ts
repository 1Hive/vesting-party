import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers, waffle } from 'hardhat'
import BalanceTree from '../src/balance-tree'
import { duration } from '../src/rpc'
import { PartyFactory, PartyFactory__factory, TestERC20, TestERC20__factory } from '../typechain'

const EVENTS = {
  NEW_OFFER: 'NewParty',
}

const overrides = {
  gasLimit: 9500000,
}

describe('Party Factory', function () {
  let signers: SignerWithAddress[]

  let token: TestERC20
  let tree: BalanceTree
  let partyFactory: PartyFactory

  before(async () => {
    signers = await ethers.getSigners()

    const TestERC20 = (await ethers.getContractFactory('TestERC20')) as TestERC20__factory
    token = await TestERC20.deploy('Token', 'TKN', 0, overrides)

    tree = new BalanceTree([
      { account: signers[0].address, amount: BigNumber.from(100) },
      { account: signers[1].address, amount: BigNumber.from(200) },
    ])
  })

  beforeEach(async () => {
    const PartyFactory = (await ethers.getContractFactory('PartyFactory')) as PartyFactory__factory

    partyFactory = await PartyFactory.deploy()
  })

  it(`should deploy correctly`, async () => {
    await expect(partyFactory.startParty(token.address, tree.getHexRoot(), 0, 0, 10, 2)).to.emit(
      partyFactory,
      EVENTS.NEW_OFFER
    )
  })

  const GAS_TARGET = !process.env.SOLIDITY_COVERAGE ? 6.5e6 : 3e6
  it(`deploys party under ${GAS_TARGET} gas`, async () => {
    const tx = partyFactory.startParty(token.address, tree.getHexRoot(), 0, 0, 10, 2)

    await expect(tx).to.not.reverted

    const { hash } = await tx
    const { gasUsed } = await waffle.provider.getTransactionReceipt(hash)

    expect(gasUsed).to.be.lte(GAS_TARGET)
  })
})
