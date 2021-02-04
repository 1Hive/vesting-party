import React from 'react'
import { HashRouter } from 'react-router-dom'
import { Main } from '@1hive/1hive-ui'
import MainView from './components/MainView'
import Routes from './Routes'
import { WalletProvider } from './providers/Wallet'
import { AppStateProvider } from './providers/AppState'

function App() {
  return (
    <WalletProvider>
      <AppStateProvider>
        <Main assetsUrl="/aragon-ui/" layout={false} scrollView={false}>
          <HashRouter>
            <MainView>
              <Routes />
            </MainView>
          </HashRouter>
        </Main>
      </AppStateProvider>
    </WalletProvider>
  )
}

export default App
