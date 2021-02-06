import React from 'react'
import { Modal } from '@1hive/1hive-ui'
import { WizardProvider } from '../../providers/Wizard'
import Screens from './Screens'

function Wizard({ opened, close }) {
  return (
    <Modal visible={opened} onClose={close}>
      <Screens />
    </Modal>
  )
}

export default (props) => (
  <WizardProvider>
    <Wizard {...props} />
  </WizardProvider>
)
