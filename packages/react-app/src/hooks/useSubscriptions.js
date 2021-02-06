import { useMemo } from 'react'
import { useQuery } from 'urql'
import { PartyFactory, Parties, Party } from '../queries'
import { transformPartyData } from '../utils/data-utils'

function useQuerySub(query, variables = {}, options = {}) {
  return useQuery({
    query: query,
    variables: variables,
    requestPolicy: 'cache-and-network',
    pollInterval: 13 * 1000,
    ...options,
  })
}

export function useFactorySubscription(factoryAddress) {
  const [{ data, error }] = useQuerySub(PartyFactory, {
    id: factoryAddress.toLowerCase(),
  })

  const factory = data?.partyFactory || null

  return { factory, fetching: !data && !error, error }
}

export function usePartiesSubscription() {
  const [{ data, error }] = useQuerySub(Parties)

  const parties = useMemo(() => {
    if (!data?.parties) {
      return []
    }

    return data.parties.map(transformPartyData)
  }, [data])

  return { parties, fetching: !data && !error, error }
}

export function usePartySubscription(partyId) {
  const [{ data, error }] = useQuerySub(Party, { id: partyId.toLowerCase() })

  const party = useMemo(() => {
    if (!data?.party) {
      return null
    }

    return transformPartyData(data.party)
  }, [data])

  return { party, fetching: !data && !error, error }
}
