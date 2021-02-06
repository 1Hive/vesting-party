import gql from 'graphql-tag'

export const PartyFactory = gql`
  query PartyFactory($id: ID!) {
    partyFactory(id: $id) {
      id
      address
      count
    }
  }
`

export const Parties = gql`
  query Parties {
    parties {
      id
      address
      host
      createdAt
      factory
      name
      symbol
      token {
        id
        name
        symbol
        decimals
      }
      merkleRoot
      upfrontPct
      vestingPeriod
      vestingDurationInPeriods
      vestingCliffInPeriods
      vestings {
        id
        tokenId
        party
        startTime
        beneficiary
        amount
        periodsClaimed
        amountClaimed
        claims {
          id
          createdAt
          beneficiary
          amount
        }
      }
    }
  }
`

export const Party = gql`
  query Party($id: ID!) {
    party(id: $id) {
      id
      address
      host
      createdAt
      factory
      name
      symbol
      token {
        id
        name
        symbol
        decimals
      }
      merkleRoot
      upfrontPct
      vestingPeriod
      vestingDurationInPeriods
      vestingCliffInPeriods
      vestings {
        id
        tokenId
        party
        startTime
        beneficiary
        amount
        periodsClaimed
        amountClaimed
        claims {
          id
          createdAt
          beneficiary
          amount
        }
      }
    }
  }
`
