import React, { useCallback, useRef } from 'react'
import { useWallet } from '../../providers/Wallet'
import { Button, IconConnect } from '@1hive/1hive-ui'

import AccountButton from './AccountButton'

function AccountModule({ compact }) {
  const buttonRef = useRef()
  const wallet = useWallet()

  const toggleModal = useCallback(
    async providerId => {
      try {
        await wallet.toggleModal()
      } catch (error) {
        console.log('errror')
      }
    },
    [wallet]
  )

  return (
    <div
      ref={buttonRef}
      tabIndex="0"
      css={`
        display: flex;
        align-items: center;
        justify-content: space-around;
        outline: 0;
      `}
    >
      {screen.id === 'connected' ? (
        <AccountButton onClick={() => window.alert('toggle')} />
      ) : (
        <Button
          icon={<IconConnect />}
          label="Enable account"
          onClick={toggleModal}
          display={compact ? 'icon' : 'all'}
        />
      )}
    </div>
  )
}

export default AccountModule
