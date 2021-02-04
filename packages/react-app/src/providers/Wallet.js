import React, { useContext } from 'react'
// import { providers as EthersProviders } from 'ethers'
import Web3Modal from 'web3modal'

import { getNetwork } from '../networks'

const web3Modal = new Web3Modal({
  network: getNetwork().type,
  cacheProvider: true,
  providerOptions: {},
})

const WalletAugmentedContext = React.createContext()

function useWalletAugmented() {
  return useContext(WalletAugmentedContext)
}

// Adds Ethers.js to the useWallet() object
function WalletAugmented({ children }) {
  return (
    <WalletAugmentedContext.Provider value={web3Modal}>
      {children}
    </WalletAugmentedContext.Provider>
  )
}

function WalletProvider({ children }) {
  return <WalletAugmented>{children}</WalletAugmented>
}

export { useWalletAugmented as useWallet, WalletProvider }
