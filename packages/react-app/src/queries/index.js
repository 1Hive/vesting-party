import gql from 'graphql-tag'

export const PartyFactory = gql`
  query PartyFactory($id: ID!) {
    partyFactory(id: $id) {
      id
      address
      count
      parties {
        id
      }
    }
  }
`
