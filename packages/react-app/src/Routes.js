import React from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import Parties from './views/Parties'

export default function Routes() {
  return (
    <Switch>
      <Redirect exact from="/" to="/parties" />
      <Route path="/parties" component={Parties} />
      <Redirect to="/parties" />
    </Switch>
  )
}
