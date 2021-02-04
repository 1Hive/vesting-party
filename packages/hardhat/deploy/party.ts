import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import BalanceTree from '../src/balance-tree'
import { BigNumber } from 'ethers'
import { duration } from '../src/rpc'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy, execute, read, log } = deployments

  const { deployer } = await getNamedAccounts()

  const signers = await hre.ethers.getSigners()

  const token = await deploy('ERC20', {
    from: deployer,
    args: ['Token', 'TKN'],
    log: true,
    deterministicDeployment: true,
  })

  const tree = new BalanceTree([
    { account: await signers[0].getAddress(), amount: BigNumber.from(100) },
    { account: await signers[1].getAddress(), amount: BigNumber.from(101) },
  ])

  const PCT_10 = `10${'00'.repeat(8)}`

  await execute(
    'PartyFactory',
    { from: deployer, log: true },
    'startParty',
    token.address,
    tree.getHexRoot(),
    duration.years(1),
    PCT_10,
    0, // day
    40,
    10
  )
}

export default func
func.dependencies = ['PartyFactory']
