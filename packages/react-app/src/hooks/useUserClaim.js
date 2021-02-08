import { useEffect, useState } from 'react'
import { getNetwork } from '../networks'
import { readAirtableAmount } from '../utils/airtable'
import { useMerkleDistributorContract } from './useContract'

// const CLAIM_PROMISES = {}

// // returns the claim for the given address, or null if not valid
// function fetchClaim(account, chainId) {
//   const formatted = isAddress(account)
//   if (!formatted) return Promise.reject(new Error('Invalid address'))
//   const key = `${chainId}:${account}`

//   return (CLAIM_PROMISES[key] =
//     CLAIM_PROMISES[key] ??
//     fetch(
//       `https://gentle-frost-9e74.uniswap.workers.dev/${chainId}/${formatted}`
//     )
//       .then((res) => {
//         if (res.status === 200) {
//           return res.json()
//         } else {
//           console.debug(
//             `No claim for account ${formatted} on chain ID ${chainId}`
//           )
//           return null
//         }
//       })
//       .catch((error) => {
//         console.error('Failed to get claim data', error)
//       }))
// }

// parse distributorContract blob and detect if user has claim data
// null means we know it does not
export function useUserClaimData(account, partyAddress) {
  const chainId = getNetwork().chainId

  const key = `${chainId}:${account}`
  const [claimInfo, setClaimInfo] = useState({})

  useEffect(() => {
    if (!account || !chainId) return
    readAirtableAmount(partyAddress, chainId, account).then(
      (accountClaimInfo) =>
        setClaimInfo((claimInfo) => {
          return {
            ...claimInfo,
            [key]: accountClaimInfo,
          }
        })
    )
  }, [account, chainId, key, partyAddress])

  return account && chainId ? claimInfo[key] : undefined
}

function useSingleCallResult(contract, fn, args) {
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!contract) {
      return
    }

    let cancelled = false
    const fetchResult = async () => {
      const resultData = await contract[fn](...args)

      if (!cancelled) {
        setResult(resultData)
      }
    }

    fetchResult()

    return () => {
      cancelled = true
    }
  }, [contract, fn, args])

  return result
}

// check if user is in blob and has not yet claimed UNI
export function useUserHasAvailableClaim(
  account,
  partyAddress,
  distributorAddress
) {
  const userClaimData = useUserClaimData(account, partyAddress)
  const distributorContract = useMerkleDistributorContract(distributorAddress)
  const isClaimedResult = useSingleCallResult(
    distributorContract,
    'isClaimed',
    [userClaimData?.index]
  )
  // user is in blob and contract marks as unclaimed
  return Boolean(userClaimData && !isClaimedResult === false)
}

export function useUserUnclaimedAmount(
  account,
  partyAddress,
  distributorAddress
) {
  const userClaimData = useUserClaimData(account, partyAddress)
  const canClaim = useUserHasAvailableClaim(
    account,
    partyAddress,
    distributorAddress
  )

  if (!canClaim || !userClaimData) {
    return BigInt(0)
  }
  return BigInt(userClaimData.amount)
}
