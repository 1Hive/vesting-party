import { useMemo } from 'react'
import { useQuery } from 'urql'
import { PartyFactory } from '../queries'
import { transformFactoryData } from '../utils/data-utils'

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

  const factory = useMemo(() => {
    if (!data?.partyFactory) {
      return null
    }

    return transformFactoryData(data.partyFactory)
  }, [data])

  return { factory, fetching: !data && !error, error }
}
