import React, { useMemo } from 'react'
import { Field, GU, Info, TextInput, Slider } from '@1hive/1hive-ui'
import Header from '../Header'
import Navigation from '../Navigation'
import { useWizard } from '../../../providers/Wizard'
import { isAddress } from 'web3-utils'

function PartyConfig({ title }) {
  const {
    onNext,
    token,
    onTokenChange,
    duration,
    onDurationChange,
    cliff,
    onCliffChange,
    upfront,
    onUpfrontChange,
  } = useWizard()

  const errors = useMemo(() => {
    const errors = []
    if (token && !isAddress(token)) {
      errors.push('Token must be a valid address')
    }

    return errors
  }, [token])

  const emptyValues = !token || !duration

  return (
    <div>
      <Header title={title} />
      <div>
        <div>Here you will decide all the details of your hosted party.</div>
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
            <TextInput
              value={token}
              onChange={onTokenChange}
              wide
              placeholder="0xcafe"
            />
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
              <TextInput
                value={duration}
                onChange={onDurationChange}
                wide
                type="number"
              />
            </Field>
            Days
          </div>
          <Field
            label="Cliff (On % of Duration)"
            css={`
              width: 100%;
            `}
          >
            <Slider value={cliff} onUpdate={onCliffChange} />
            <span>{Math.round(100 * cliff)} %</span>
          </Field>
          <Field
            label="Upfront Token Amount (On %)"
            css={`
              width: 100%;
            `}
          >
            <Slider value={upfront} onUpdate={onUpfrontChange} />
            <span>{Math.round(100 * upfront)} %</span>
          </Field>
        </div>
      </div>

      {errors.length > 0 && (
        <Info
          mode="warning"
          css={`
            margin-bottom: ${2 * GU}px;
          `}
        >
          {errors.map(error => {
            return <div>{error}</div>
          })}
        </Info>
      )}
      <Navigation
        nextEnabled={!emptyValues && errors.length === 0}
        onNext={onNext}
        showBack={false}
      />
    </div>
  )
}

export default PartyConfig
