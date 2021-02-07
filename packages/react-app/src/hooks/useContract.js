import { useMemo } from 'react'
import { Contract, AddressZero } from 'ethers'
import { useWallet } from 'use-wallet'
import { getNetwork } from '../networks'

const FACTORY_ABI = [
  'function startParty(address,bytes32,uint64,uint8,uint16,uint16) public returns (address)',
  'event NewParty(address)',
]

// account is not optional
export function getSigner(ethersProvider, account) {
  ethersProvider.getSigner(account)
  return ethersProvider.getSigner(account).connectUnchecked()
}

// account is optional
export function getProviderOrSigner(ethersProvider, account) {
  return account ? getSigner(ethersProvider, account) : ethersProvider
}

// account is optional
export function getContract(address, ABI, ethersProvider, account) {
  if (!address === AddressZero) {
    throw Error(`Invalid 'address' parameter '${address}'.`)
  }

  return new Contract(
    address,
    ABI,
    getProviderOrSigner(ethersProvider, account)
  )
}

// account is optional
// returns null on errors
function useContract(
  address,
  ABI,
  ethersProvider,
  withSignerIfPossible = true
) {
  const { account } = useWallet()

  return useMemo(() => {
    if (!address || !ABI || !ethersProvider) return null
    try {
      return getContract(
        address,
        ABI,
        ethersProvider,
        withSignerIfPossible && account ? account : undefined
      )
    } catch (error) {
      console.error('Failed to get contract', error)
      return null
    }
  }, [address, ABI, ethersProvider, withSignerIfPossible, account])
}

export function useFactoryContract(ethersProvider, withSignerIfPossible) {
  const { factory } = getNetwork()
  return useContract(factory, FACTORY_ABI, ethersProvider, withSignerIfPossible)
}
