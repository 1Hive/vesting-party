import React from 'react'
import { Bar, GU } from '@1hive/1hive-ui'
import { useAppState } from '../providers/AppState'
import Party from '../components/Party'

function Parties() {
  const { factory } = useAppState()
  const { parties = [] } = factory || {}

  return (
    <div
      css={`
        margin-top: ${4 * GU}px;
      `}
    >
      <Bar>Filters</Bar>
      <div
        css={`
          display: flex;
          align-items: center;
          column-gap: ${2 * GU}px;
        `}
      >
        {parties.length > 0 &&
          parties.map((party, index) => {
            return <Party key={index} party={party} />
          })}
      </div>
    </div>
  )
}

export default Parties
