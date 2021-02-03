import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers, waffle } from 'hardhat'
import BalanceTree from '../src/balance-tree'
import { duration } from '../src/rpc'
import { OfferFactory, OfferFactory__factory, TestERC20, TestERC20__factory } from '../typechain'

const overrides = {
  gasLimit: 9500000,
}

describe('Offer Factory', function () {
  let signers: SignerWithAddress[]

  let token: TestERC20
  let tree: BalanceTree
  let offerFactory: OfferFactory

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
    const OfferFactory = (await ethers.getContractFactory('OfferFactory')) as OfferFactory__factory

    offerFactory = await OfferFactory.deploy()
  })

  const GAS_TARGET = !process.env.SOLIDITY_COVERAGE ? 6.5e6 : 3e6
  it(`deploys offer under ${GAS_TARGET} gas`, async () => {
    const tx = offerFactory.createOffer(token.address, tree.getHexRoot(), duration.years(1), 0, 0, 10, 2)

    await expect(tx).to.not.reverted

    const { hash } = await tx
    const { gasUsed } = await waffle.provider.getTransactionReceipt(hash)

    expect(gasUsed).to.be.lte(GAS_TARGET)
  })
})
