import 'dotenv/config'
import { utils } from 'ethers'
import fs from 'fs'
import chalk from 'chalk'

import { task, HardhatUserConfig } from 'hardhat/config'

import '@nomiclabs/hardhat-waffle'
import '@tenderly/hardhat-tenderly'
import 'hardhat-deploy'
import 'hardhat-abi-exporter'
import 'hardhat-gas-reporter'
import 'hardhat-typechain'
import 'solidity-coverage'
import { HttpNetworkUserConfig } from 'hardhat/types'

const { isAddress, getAddress, formatUnits, parseUnits } = utils

/*
      📡 This is where you configure your deploy configuration for 🏗 scaffold-eth

      check out `packages/scripts/deploy.js` to customize your deployment

      out of the box it will auto deploy anything in the `contracts` folder and named *.sol
      plus it will use *.args for constructor args
*/

//
// Select the network you want to deploy to here:
//
const defaultNetwork = 'hardhat'

function mnemonic() {
  try {
    return fs.readFileSync('./mnemonic.txt').toString().trim()
  } catch (e) {
    if (defaultNetwork !== 'hardhat') {
      console.log(
        '☢️ WARNING: No mnemonic file created for a deploy account. Try `yarn run generate` and then `yarn run account`.'
      )
    }
  }
  return ''
}

const config: HardhatUserConfig = {
  defaultNetwork,

  // don't forget to set your provider like:
  // REACT_APP_PROVIDER=https://dai.poa.network in packages/react-app/.env
  // (then your frontend will talk to your contracts on the live network!)
  // (you will need to restart the `yarn run start` dev server after editing the .env)

  networks: {
    localhost: {
      url: 'http://localhost:8545',
      /*
        notice no mnemonic here? it will just use account 0 of the hardhat node to deploy
        (you can put in a mnemonic here to set the deployer locally)
      */
    },
    coverage: {
      url: 'http://localhost:8555',
      allowUnlimitedContractSize: true,
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`, //<---- YOUR INFURA ID! (or it won't work)
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`, //<---- YOUR INFURA ID! (or it won't work)
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`, //<---- YOUR INFURA ID! (or it won't work)
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_KEY}`, //<---- YOUR INFURA ID! (or it won't work)
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`, //<---- YOUR INFURA ID! (or it won't work)
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    xdai: {
      url: 'https://rpc.xdaichain.com/',
      gasPrice: 1000000000,
      accounts: {
        mnemonic: mnemonic(),
      },
    },
    matic: {
      url: 'https://rpc-mainnet.maticvigil.com/',
      gasPrice: 1000000000,
      accounts: {
        mnemonic: mnemonic(),
      },
    },
  },
  solidity: {
    version: '0.6.7',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  abiExporter: {
    path: './abis',
    clear: true,
  },
  tenderly: {
    username: '0xgabi',
    project: 'vested',
  },
}

const DEBUG = false

function debug(text) {
  if (DEBUG) {
    console.log(text)
  }
}

// Setup a new party using the existing factory and tokens deployed:
// hardhat start-party --root <root> --upfront <pct> --duration <#days> --cliff <#days> --deposit <amount> --network <network>
task('start-party', 'Get the party started 🎉')
  .addParam('root', 'The merkle root hash')
  .addParam('upfront', 'Upfront vesting %')
  .addParam('duration', 'Vesting duration in days')
  .addParam('cliff', 'Vesting clif in days')
  .addOptionalParam('deposit', 'Amount of tokens to deposit in the party')
  .setAction(async ({ root, upfront, duration, cliff, deposit }, hre) => {
    const { deployments, getNamedAccounts } = hre
    const { execute } = deployments

    const { deployer } = await getNamedAccounts()

    const recipt = await execute(
      'PartyFactory',
      { from: deployer, gasLimit: 9500000, log: true },
      'startParty',
      (await deployments.get('TestERC20')).address,
      root,
      upfront,
      0, // day
      duration,
      cliff
    )

    const partyFactoryInterface = new hre.ethers.utils.Interface((await hre.artifacts.readArtifact('PartyFactory')).abi)
    const { args } = recipt.logs
      .map((log) => partyFactoryInterface.parseLog(log))
      .find(({ name }) => name === 'NewParty')

    console.log(`🍻 Party address: ${args[0]}`)

    if (deposit) {
      await execute(
        'TestERC20',
        { from: deployer, gasLimit: 9500000, log: true },
        'setBalance',
        args[0],
        hre.ethers.BigNumber.from(deposit)
      )
    }
  })

task('wallet', 'Create a wallet (pk) link', async (_, { ethers }) => {
  const randomWallet = ethers.Wallet.createRandom()
  const privateKey = randomWallet._signingKey().privateKey
  console.log('🔐 WALLET Generated as ' + randomWallet.address + '')
  console.log('🔗 http://localhost:3000/pk#' + privateKey)
})

task('fundedwallet', 'Create a wallet (pk) link and fund it with deployer?')
  .addOptionalParam('amount', 'Amount of ETH to send to wallet after generating')
  .addOptionalParam('url', 'URL to add pk to')
  .setAction(async (taskArgs, { network, ethers }) => {
    const randomWallet = ethers.Wallet.createRandom()
    const privateKey = randomWallet._signingKey().privateKey
    console.log('🔐 WALLET Generated as ' + randomWallet.address + '')
    let url = taskArgs.url ? taskArgs.url : 'http://localhost:3000'

    let localDeployerMnemonic
    try {
      localDeployerMnemonic = fs.readFileSync('./mnemonic.txt')
      localDeployerMnemonic = localDeployerMnemonic.toString().trim()
    } catch (e) {
      /* do nothing - this file isn't always there */
    }

    let amount = taskArgs.amount ? taskArgs.amount : '0.01'
    const tx = {
      to: randomWallet.address,
      value: ethers.utils.parseEther(amount),
    }

    //SEND USING LOCAL DEPLOYER MNEMONIC IF THERE IS ONE
    // IF NOT SEND USING LOCAL HARDHAT NODE:
    if (localDeployerMnemonic) {
      let deployerWallet = ethers.Wallet.fromMnemonic(localDeployerMnemonic)
      deployerWallet = deployerWallet.connect(ethers.provider)
      console.log('💵 Sending ' + amount + ' ETH to ' + randomWallet.address + ' using deployer account')
      let sendresult = await deployerWallet.sendTransaction(tx)
      console.log('\n' + url + '/pk#' + privateKey + '\n')
      return
    } else {
      console.log('💵 Sending ' + amount + ' ETH to ' + randomWallet.address + ' using local node')
      console.log('\n' + url + '/pk#' + privateKey + '\n')
      return send(ethers.provider.getSigner(), tx)
    }
  })

task('generate', 'Create a mnemonic for builder deploys', async (_, { ethers }) => {
  const bip39 = require('bip39')
  const hdkey = require('ethereumjs-wallet/hdkey')
  const mnemonic = bip39.generateMnemonic()
  if (DEBUG) console.log('mnemonic', mnemonic)
  const seed = await bip39.mnemonicToSeed(mnemonic)
  if (DEBUG) console.log('seed', seed)
  const hdwallet = hdkey.fromMasterSeed(seed)
  const wallet_hdpath = "m/44'/60'/0'/0/"
  const account_index = 0
  let fullPath = wallet_hdpath + account_index
  if (DEBUG) console.log('fullPath', fullPath)
  const wallet = hdwallet.derivePath(fullPath).getWallet()
  const privateKey = '0x' + wallet._privKey.toString('hex')
  if (DEBUG) console.log('privateKey', privateKey)
  var EthUtil = require('ethereumjs-util')
  const address = '0x' + EthUtil.privateToAddress(wallet._privKey).toString('hex')
  console.log('🔐 Account Generated as ' + address + ' and set as mnemonic in packages/hardhat')
  console.log("💬 Use 'yarn run account' to get more information about the deployment account.")

  fs.writeFileSync('./' + address + '.txt', mnemonic.toString())
  fs.writeFileSync('./mnemonic.txt', mnemonic.toString())
})

task('mine', 'Looks for a deployer account that will give leading zeros')
  .addParam('searchFor', 'String to search for')
  .setAction(async (taskArgs, { network, ethers }) => {
    let contract_address = ''
    let address

    const bip39 = require('bip39')
    const hdkey = require('ethereumjs-wallet/hdkey')

    let mnemonic = ''
    while (contract_address.indexOf(taskArgs.searchFor) != 0) {
      mnemonic = bip39.generateMnemonic()
      if (DEBUG) console.log('mnemonic', mnemonic)
      const seed = await bip39.mnemonicToSeed(mnemonic)
      if (DEBUG) console.log('seed', seed)
      const hdwallet = hdkey.fromMasterSeed(seed)
      const wallet_hdpath = "m/44'/60'/0'/0/"
      const account_index = 0
      let fullPath = wallet_hdpath + account_index
      if (DEBUG) console.log('fullPath', fullPath)
      const wallet = hdwallet.derivePath(fullPath).getWallet()
      const privateKey = '0x' + wallet._privKey.toString('hex')
      if (DEBUG) console.log('privateKey', privateKey)
      var EthUtil = require('ethereumjs-util')
      address = '0x' + EthUtil.privateToAddress(wallet._privKey).toString('hex')

      const rlp = require('rlp')
      const keccak = require('keccak')

      let nonce = 0x00 //The nonce must be a hex literal!
      let sender = address

      let input_arr = [sender, nonce]
      let rlp_encoded = rlp.encode(input_arr)

      let contract_address_long = keccak('keccak256').update(rlp_encoded).digest('hex')

      contract_address = contract_address_long.substring(24) //Trim the first 24 characters.
    }

    console.log('⛏  Account Mined as ' + address + ' and set as mnemonic in packages/hardhat')
    console.log('📜 This will create the first contract: ' + chalk.magenta('0x' + contract_address))
    console.log("💬 Use 'yarn run account' to get more information about the deployment account.")

    fs.writeFileSync('./' + address + '_produces' + contract_address + '.txt', mnemonic.toString())
    fs.writeFileSync('./mnemonic.txt', mnemonic.toString())
  })

task('account', 'Get balance informations for the deployment account.', async (_, { ethers }) => {
  const hdkey = require('ethereumjs-wallet/hdkey')
  const bip39 = require('bip39')
  let mnemonic = fs.readFileSync('./mnemonic.txt').toString().trim()
  if (DEBUG) console.log('mnemonic', mnemonic)
  const seed = await bip39.mnemonicToSeed(mnemonic)
  if (DEBUG) console.log('seed', seed)
  const hdwallet = hdkey.fromMasterSeed(seed)
  const wallet_hdpath = "m/44'/60'/0'/0/"
  const account_index = 0
  let fullPath = wallet_hdpath + account_index
  if (DEBUG) console.log('fullPath', fullPath)
  const wallet = hdwallet.derivePath(fullPath).getWallet()
  const privateKey = '0x' + wallet._privKey.toString('hex')
  if (DEBUG) console.log('privateKey', privateKey)
  var EthUtil = require('ethereumjs-util')
  const address = '0x' + EthUtil.privateToAddress(wallet._privKey).toString('hex')

  var qrcode = require('qrcode-terminal')
  qrcode.generate(address)
  console.log('‍📬 Deployer Account is ' + address)
  for (let n in config.networks) {
    //console.log(config.networks[n],n)
    try {
      let provider = new ethers.providers.JsonRpcProvider((config.networks[n] as HttpNetworkUserConfig).url)
      let balance = await provider.getBalance(address)
      console.log(' -- ' + n + ' --  -- -- 📡 ')
      console.log('   balance: ' + ethers.utils.formatEther(balance))
      console.log('   nonce: ' + (await provider.getTransactionCount(address)))
    } catch (e) {
      if (DEBUG) {
        console.log(e)
      }
    }
  }
})

async function addr(ethers, addr) {
  if (isAddress(addr)) {
    return getAddress(addr)
  }
  const accounts = await ethers.provider.listAccounts()
  if (accounts[addr] !== undefined) {
    return accounts[addr]
  }
  throw `Could not normalize address: ${addr}`
}

task('accounts', 'Prints the list of accounts', async (_, { ethers }) => {
  const accounts = await ethers.provider.listAccounts()
  accounts.forEach((account) => console.log(account))
})

task('blockNumber', 'Prints the block number', async (_, { ethers }) => {
  const blockNumber = await ethers.provider.getBlockNumber()
  console.log(blockNumber)
})

task('balance', "Prints an account's balance")
  .addPositionalParam('account', "The account's address")
  .setAction(async (taskArgs, { ethers }) => {
    const balance = await ethers.provider.getBalance(await addr(ethers, taskArgs.account))
    console.log(formatUnits(balance, 'ether'), 'ETH')
  })

function send(signer, txparams) {
  return signer.sendTransaction(txparams, (error, transactionHash) => {
    if (error) {
      debug(`Error: ${error}`)
    }
    debug(`transactionHash: ${transactionHash}`)
    // checkForReceipt(2, params, transactionHash, resolve)
  })
}

task('send', 'Send ETH')
  .addParam('from', 'From address or account index')
  .addOptionalParam('to', 'To address or account index')
  .addOptionalParam('amount', 'Amount to send in ether')
  .addOptionalParam('data', 'Data included in transaction')
  .addOptionalParam('gasPrice', 'Price you are willing to pay in gwei')
  .addOptionalParam('gasLimit', 'Limit of how much gas to spend')

  .setAction(async (taskArgs, { network, ethers }) => {
    const from = await addr(ethers, taskArgs.from)
    debug(`Normalized from address: ${from}`)
    const fromSigner = await ethers.provider.getSigner(from)

    let to
    if (taskArgs.to) {
      to = await addr(ethers, taskArgs.to)
      debug(`Normalized to address: ${to}`)
    }

    const txRequest = {
      from: await fromSigner.getAddress(),
      to,
      value: parseUnits(taskArgs.amount ? taskArgs.amount : '0', 'ether').toHexString(),
      nonce: await fromSigner.getTransactionCount(),
      gasPrice: parseUnits(taskArgs.gasPrice ? taskArgs.gasPrice : '1.001', 'gwei').toHexString(),
      gasLimit: taskArgs.gasLimit ? taskArgs.gasLimit : 24000,
      chainId: network.config.chainId,
      data: undefined,
    }

    if (taskArgs.data !== undefined) {
      txRequest.data = taskArgs.data
      debug(`Adding data to payload: ${txRequest.data}`)
    }
    debug(ethers.BigNumber.from(txRequest.gasPrice).div(1000000000).toHexString() + ' gwei')
    debug(JSON.stringify(txRequest, null, 2))

    return send(fromSigner, txRequest)
  })

export default config
