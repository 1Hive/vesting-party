#!/bin/bash

NETWORK=$1

DATA=manifest/data/$NETWORK'.json'

HARDHAT_PACKAGE=$(node -e 'console.log(require("path").dirname(require.resolve("@scaffold-eth/hardhat/package.json")))')

echo 'Generating manifest from data file: '$DATA
cat $DATA

mustache \
  -p manifest/templates/sources/PartyFactory.yaml \
  -p manifest/templates/contracts/PartyFactory.template.yaml \
  $DATA \
  src/subgraph.template.yaml \
  | sed -e "s#\$HARDHAT_PACKAGE#$HARDHAT_PACKAGE#g" > subgraph.yaml
