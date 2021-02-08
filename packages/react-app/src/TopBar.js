import React from 'react'
import { Bar, Button, GU } from '@1hive/1hive-ui'
import Filters from './components/Filters'
import { useWallet } from './providers/Wallet'

function TopBar({ filters }) {
  const { account } = useWallet()
  return (
    <Bar>
      <div
        css={`
          display: flex;
          algin-items: center;
          justify-content: space-between;
          padding: ${1.5 * GU}px;
        `}
      >
        {account ? <Filters filters={filters} /> : <div />}
        <Button
          label="Create party!"
          mode="strong"
          onClick={() => window.alert('Open wizard')}
        />
      </div>
    </Bar>
  )
}

export default TopBar
