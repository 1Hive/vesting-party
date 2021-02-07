import React, { useCallback, useContext, useState } from 'react'
import PropTypes from 'prop-types'

const WizardContext = React.createContext()

function WizardProvider({ children }) {
  const [step, setStep] = useState(0)
  const [token, setToken] = useState('')
  const [duration, setDuration] = useState(0)
  const [cliff, setCliff] = useState(0)
  const [upfront, setUpfront] = useState(0)
  const [settings, setSettings] = useState()
  const [data, setData] = useState()

  const onNext = useCallback(() => setStep(step => step + 1), [])

  const onBack = useCallback(() => setStep(step => Math.max(0, step - 1)), [])

  const onTokenChange = useCallback(event => setToken(event.target.value), [])

  const onDurationChange = useCallback(
    event => setDuration(parseInt(event.target.value)),
    []
  )

  const onCliffChange = useCallback(
    event => setCliff(parseInt(event.target.value)),
    []
  )

  const onUpfrontChange = useCallback(
    value => setUpfront(Math.round(value * 100) / 100),
    []
  )

  const onSettingsChange = useCallback(settings => setSettings(settings), [])

  const onDataChange = useCallback(event => setData(event.target.files[0]), [])

  return (
    <WizardContext.Provider
      value={{
        step,
        onNext,
        onBack,
        token,
        onTokenChange,
        duration,
        onDurationChange,
        cliff,
        onCliffChange,
        upfront,
        onUpfrontChange,
        data,
        onDataChange,
        settings,
        onSettingsChange,
      }}
    >
      {children}
    </WizardContext.Provider>
  )
}

WizardProvider.propTypes = {
  children: PropTypes.node,
}

function useWizard() {
  return useContext(WizardContext)
}

export { WizardProvider, useWizard }
