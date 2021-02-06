import React, { useEffect, useRef } from 'react'
import { Field, GU, TextInput, DropDown, Slider } from '@1hive/1hive-ui'
import Header from '../Header'
import Navigation from '../Navigation'
import { useWizard } from '../../../providers/Wizard'

function PartyConfig({ title }) {
  const {
    onNext,
    token,
    onTokenChange,
    duration,
    onDurationChange,
    selected,
    onSelected,
    cliff,
    onCliffChange,
    upfront,
    onUpfrontChange,
  } = useWizard()

  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        // Component could have been unmounted on timeout
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 1500)
    }
  }, [])

  return (
    <div>
      <Header title={title} />
      <div>
        <div>
          Here you will configure all you need to get your party started 🎉
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
            <TextInput
              value={token}
              onChange={onTokenChange}
              wide
              ref={inputRef}
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
                type="num"
              />
            </Field>
            <Field
              label="Period of Time"
              css={`
                width: 100%;
              `}
            >
              <DropDown
                items={['Days', 'Weeks', 'Months']}
                selected={selected}
                onChange={onSelected}
              />
            </Field>
          </div>
          <Field
            label="Cliff (On % of Duration)"
            css={`
              width: 100%;
            `}
          >
            <Slider value={cliff} onUpdate={onCliffChange} />
          </Field>
          <Field
            label="Upfront Amount (On %)"
            css={`
              width: 100%;
            `}
          >
            <Slider value={upfront} onUpdate={onUpfrontChange} />
          </Field>
        </div>
      </div>
      <Navigation nextEnabled={''} onNext={onNext} showBack={false} />
    </div>
  )
}

export default PartyConfig
