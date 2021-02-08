import env from '../environment'

const Airtable = require('airtable')

Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: env('AIRTABLE_KEY'),
})

const base = Airtable.base('appoEtN1RpO4eniQJ')

export function writeAirtableData(party, chainId, data) {
  data.map((user, index) =>
    base('data').create(
      [
        {
          fields: {
            id: `${party}:${chainId}:${user.account}`,
            index: index,
            account: user.account,
            amount: user.amount,
          },
        },
      ],
      function (err, records) {
        if (err) {
          console.error(err)
          return
        }
        records.forEach(function (record) {
          console.log(record.getId())
        })
      }
    )
  )
}

export function readAirtableUser(party, chainId, account) {
  base('data')
    .select({
      maxRecords: 1,
      view: 'Grid view',
      fields: ['id', 'index', 'account', 'amount'],
      filterByFormula: `id = '${party}:${chainId}:${account}'`,
    })
    .eachPage(
      function page(records) {
        return {
          index: records[0].get('index'),
          account: records[0].get('account'),
          amount: records[0].get('amount'),
        }
      },
      function done(err) {
        if (err) {
          console.error(err)
        }
      }
    )
}
