const Airtable = require('airtable')

Airtable.configure({
  endpointUrl: 'https://api.airtable.com',
  apiKey: 'keyaFQcjixVE9ngtN',
})

const base = Airtable.base('appoEtN1RpO4eniQJ')

export function writeAirtableData(party, chainId, data) {
  data.map((user) =>
    base('data').create(
      [
        {
          fields: {
            id: `${party}:${chainId}:${user.account}`,
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
