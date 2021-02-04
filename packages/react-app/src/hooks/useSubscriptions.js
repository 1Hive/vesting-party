import { useQuery } from 'urql'
import { PartyFactory } from '../queries'

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
  const [{ data, error }] = useQuerySub(
    PartyFactory,
    factoryAddress.toLowerCase()
  )

  const factory = data?.partyFactory || null

  return { factory, fetching: !data && !error, error }
}
