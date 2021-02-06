import React, { useContext } from 'react'
import PropTypes from 'prop-types'

import { getNetwork } from '../networks'
import { useFactorySubscription } from '../hooks/useSubscriptions'

const AppStateContext = React.createContext()

function AppStateProvider({ children }) {
  const factoryAddress = getNetwork().factory
  const { factory } = useFactorySubscription(factoryAddress)

  return (
    <AppStateContext.Provider value={{ factory }}>
      {children}
    </AppStateContext.Provider>
  )
}

AppStateProvider.propTypes = {
  children: PropTypes.node,
}

function useAppState() {
  return useContext(AppStateContext)
}

export { AppStateProvider, useAppState }
