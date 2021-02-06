import React, { useMemo } from 'react'
import { Card, GU, useTheme } from '@1hive/1hive-ui'
import partySvg from '../assets/party.svg'

function Party({ party }) {
  const theme = useTheme()

  const vestedTokens = useMemo(() => {
    return party.vestings.reduce((acc, vesting) => {
      return acc.plus(vesting.amount)
    }, BigInt('0'))
  }, [party.vestings])

  return (
    <Card>
      <div>
        <img src={partySvg} alt="" height="40" />
        <div
          css={`
            margin-left: ${2 * GU}px;
          `}
        >
          {party.name}
        </div>
      </div>
      <div>
        <label
          css={`
            color: ${theme.contentSecondary};
            margin-bottom: ${2 * GU}px;
          `}
        >
          Vested tokens:
        </label>
        <span>{vestedTokens.toString()}</span>
      </div>
    </Card>
  )
}

export default Party
