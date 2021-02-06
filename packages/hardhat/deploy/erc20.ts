import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy('TestERC20', {
    from: deployer,
    args: ['Token', 'TKN', 10000],
    log: true,
    deterministicDeployment: true,
  })
}

export default func

func.tags = ['token']
