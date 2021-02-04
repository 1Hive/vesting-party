import React from 'react'
import { useAppState } from '../providers/AppState'

function Parties() {
  const { factory } = useAppState()

  return <div>{factory.id}</div>
}

export default Parties
