import React, { useCallback, useContext, useState } from 'react'
import PropTypes from 'prop-types'

const WizardContext = React.createContext()

function WizardProvider({ children }) {
  const [step, setStep] = useState(0)
  const [token, setToken] = useState(null)
  const [duration, setDuration] = useState(0)
  const [selected, setSelected] = useState(0)
  const [cliff, setCliff] = useState(0)
  const [upfront, setUpfront] = useState(0)

  const onNext = useCallback(() => setStep((step) => step + 1), [])

  const onBack = useCallback(() => setStep((step) => Math.max(0, step - 1)), [])

  const onTokenChange = useCallback((event) => setToken(event.target.value), [])

  const onDurationChange = useCallback(
    (event) => setDuration(event.target.value),
    []
  )

  const onSelected = useCallback((value) => setSelected(value), [])

  const onCliffChange = useCallback((value) => setCliff(value), [])

  const onUpfrontChange = useCallback((value) => setUpfront(value), [])

  return (
    <WizardContext.Provider
      value={{
        step,
        onNext,
        onBack,
        token,
        onTokenChange,
        duration,
        selected,
        onSelected,
        onDurationChange,
        cliff,
        onCliffChange,
        upfront,
        onUpfrontChange,
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
