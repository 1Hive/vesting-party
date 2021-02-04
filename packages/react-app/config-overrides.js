/* config-overrides.js */

const path = require('path')
const { useBabelRc, override } = require('customize-cra')

module.exports = override(
  useBabelRc(),
)


