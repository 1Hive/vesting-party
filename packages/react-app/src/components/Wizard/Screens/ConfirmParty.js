import React, { useCallback } from 'react'
import { Field, GU } from '@1hive/1hive-ui'
import Header from '../Header'
import Navigation from '../Navigation'
import { useWizard } from '../../../providers/Wizard'
import { PCT_BASE } from '../../../constants'

function ConfirmParty({ title }) {
  const {
    onNext,
    onBack,
    token,
    duration,
    cliff,
    upfront,
    onSettingsChange,
  } = useWizard()

  const handleStartParty = useCallback(() => {
    onSettingsChange({
      token: token,
      root:
        '0xd6269acc7df5d5a44d0f7a89aea9f7d33b1ed6961f33685bfa57c5260052dd52',
      upfront: (BigInt(Math.round(100 * upfront)) * PCT_BASE) / BigInt(100),
      period: 0,
      duration: duration,
      cliff: cliff,
    })
    onNext()
  }, [onNext, token, duration, cliff, onSettingsChange, upfront])

  return (
    <div>
      <Header title={title} />
      <div>
        <div>
          Here you will review the details of your party and sent a transaction
          to start it.
        </div>
        <div
          css={`
            margin-top: ${3 * GU}px;
          `}
        >
          <Field
            label="Token Address"
            css={`
              width: 100%;
            `}
          >
            {token}
          </Field>
          <div
            css={`
              display: flex;
              align-items: center;
            `}
          >
            <Field
              label="Vesting Duration"
              css={`
                width: 100%;
                margin-right: ${1.5 * GU}px;
              `}
            >
              {duration} Days
            </Field>
          </div>
          <Field
            label="Cliff Duration"
            css={`
              width: 100%;
            `}
          >
            <span>{cliff} Days</span>
          </Field>
          <Field
            label="Upfront Token Amount"
            css={`
              width: 100%;
            `}
          >
            <span>{Math.round(100 * upfront)} %</span>
          </Field>
        </div>
      </div>
      <Navigation
        nextLabel="Start Party!"
        onNext={handleStartParty}
        onBack={onBack}
      />
    </div>
  )
}

export default ConfirmParty
