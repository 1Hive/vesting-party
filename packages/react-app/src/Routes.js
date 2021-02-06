import React from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import Party from './views/Party'
import Parties from './views/Parties'

export default function Routes() {
  return (
    <Switch>
      <Redirect exact from="/" to="/parties" />
      <Route path="/parties" component={Parties} />
      <Route exact path="/party/:id" component={Party} />
      <Redirect to="/parties" />
    </Switch>
  )
}
