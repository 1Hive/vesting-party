import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import BalanceTree from '../src/balance-tree'
import { BigNumber } from 'ethers'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { deploy } = deployments

  const signers = await ethers.getSigners()

  const { deployer } = await getNamedAccounts()

  const token = await deployments.get('TestERC20')

  const tree = new BalanceTree([
    { account: signers[0].address, amount: BigNumber.from(100) },
    { account: signers[1].address, amount: BigNumber.from(101) },
  ])

  const PCT_20 = `20${'00'.repeat(8)}`

  await deploy('Party', {
    from: deployer,
    args: [
      token.address,
      tree.getHexRoot(),
      PCT_20,
      0,
      10,
      2
    ],
    log: true,
  })
}

export default func

func.tags = ['Party']