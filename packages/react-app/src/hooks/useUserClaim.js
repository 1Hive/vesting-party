import { useEffect, useState } from 'react'
import { getNetwork } from '../networks'
import { readAirtableUser } from '../utils/airtable'
import { useMerkleDistributorContract } from './useContract'

// parse distributorContract blob and detect if user has claim data
// null means we know it does not
export function useUserClaimInfo(partyAddress, account) {
  const chainId = getNetwork().chainId

  const key = `${partyAddress}:${chainId}:${account}`
  const [claimInfo, setClaimInfo] = useState({})

  useEffect(() => {
    if (!partyAddress || !account || !chainId) return
    readAirtableUser(partyAddress, chainId, account).then((accountClaimInfo) =>
      setClaimInfo((claimInfo) => {
        return {
          ...claimInfo,
          [key]: accountClaimInfo,
        }
      })
    )
  }, [account, chainId, partyAddress, key])

  return partyAddress && account && chainId ? claimInfo : undefined
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
  partyAddress,
  account,
  distributorAddress
) {
  const userClaimInfo = useUserClaimInfo(partyAddress, account)
  const distributorContract = useMerkleDistributorContract(distributorAddress)
  const isClaimedResult = useSingleCallResult(
    distributorContract,
    'isClaimed',
    [BigInt(userClaimInfo?.index)]
  )
  // user is in blob and contract marks as unclaimed
  return Boolean(userClaimInfo && !isClaimedResult === false)
}

export function useUserUnclaimedAmount(
  partyAddress,
  account,
  distributorAddress
) {
  const userClaimInfo = useUserClaimInfo(partyAddress, account)
  const canClaim = useUserHasAvailableClaim(
    partyAddress,
    account,
    userClaimInfo.index,
    distributorAddress
  )

  if (!canClaim || !userClaimInfo.amount) {
    return BigInt(0)
  }
  return BigInt(userClaimInfo.amount)
}
