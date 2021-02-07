import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, GU, Info, AddressField } from '@1hive/1hive-ui'
import Header from '../Header'
import { useWallet } from '../../../providers/Wallet'
import { useWizard } from '../../../providers/Wizard'
import TransactionStatus from '../../Transaction/TransactionStatus'
import {
  TX_STATUS_SIGNED,
  TX_STATUS_PENDING,
  TX_STATUS_CONFIRMED,
  TX_STATUS_SIGNATURE_FAILED,
  TX_STATUS_FAILED,
} from '../../Transaction/transaction-statuses'
import { useFactoryContract } from '../../../hooks/useContract'

const EMPTY_STATE = {
  signed: false,
  confirmed: false,
  errorSigning: false,
  failed: false,
}

function StartParty({ title }) {
  const { ethers } = useWallet()
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState(EMPTY_STATE)
  const [partyAddress, setPartyAddress] = useState(null)
  const [error, setError] = useState('')
  const { settings } = useWizard()
  const factory = useFactoryContract(ethers)

  const status = useMemo(() => {
    if (progress.errorSigning) {
      return TX_STATUS_SIGNATURE_FAILED
    }

    if (progress.failed) {
      return TX_STATUS_FAILED
    }

    if (progress.confirmed) {
      return TX_STATUS_CONFIRMED
    }

    if (progress.signed) {
      return TX_STATUS_SIGNED
    }

    return TX_STATUS_PENDING
  }, [progress])

  const handleNextAttempt = useCallback(() => {
    setAttempt((attempt) => attempt + 1)
  }, [])

  const signTx = useCallback(async () => {
    try {
      const tx = await factory.startParty(
        settings.token,
        settings.root,
        settings.upfront,
        settings.period,
        settings.duration,
        settings.cliff,
        { gasLimit: 9500000 }
      )
      setProgress((progress) => ({
        ...progress,
        signed: true,
      }))
      return tx
    } catch (err) {
      setError(err.message)
      setProgress((progress) => ({ ...progress, errorSigning: true }))
    }
  }, [])

  const ensureConfirmation = useCallback(async (signedTx) => {
    try {
      const recipt = await signedTx.wait()

      const { args } = recipt.logs
        .map((log) => factory.interface.parseLog(log))
        .find(({ name }) => name === 'NewParty')

      setPartyAddress(args[0])
      setProgress((progress) => ({ ...progress, confirmed: true }))
    } catch (err) {
      setProgress((progress) => ({ ...progress, failed: true }))
    }
  }, [])

  useEffect(() => {
    if (progress.confirmed) {
      return
    }

    setProgress((progress) => ({
      ...progress,
      errorSigning: false,
      failed: false,
    }))

    const start = async () => {
      try {
        const signedTx = await signTx()
        await ensureConfirmation(signedTx)
      } catch (err) {
        console.error(err)
      }
    }

    start()
  }, [
    error,
    settings,
    attempt,
    ethers,
    ensureConfirmation,
    signTx,
    partyAddress,
  ])

  return (
    <div>
      <Header title={title} />
      <div
        css={`
          display: flex;
          flex-direction: column;
          align-items: center;
        `}
      >
        <TransactionStatus status={status} error={error} />
        <div
          css={`
            margin-top: ${2 * GU}px;
            text-align: center;
          `}
        >
          {status === TX_STATUS_CONFIRMED && (
            <>
              <Info
                css={`
                  margin-bottom: ${3 * GU}px;
                `}
              >
                Your party was created 🍾
              </Info>
              <div
                css={`
                  margin-top: ${3 * GU}px;
                  margin-bottom: ${2 * GU}px;
                  text-align: center;
                `}
              >
                <AddressField address={partyAddress} />
              </div>
              This is the address where you will deposit the tokens to
              distribute.
            </>
          )}
          {(status === TX_STATUS_FAILED ||
            status === TX_STATUS_SIGNATURE_FAILED) && (
            <Button label="Retry" mode="strong" onClick={handleNextAttempt} />
          )}
        </div>
      </div>
    </div>
  )
}

export default StartParty
