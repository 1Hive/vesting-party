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

// TODO: Write
// var Airtable = require("airtable");
// var base = new Airtable({ apiKey: "keyaFQcjixVE9ngtN" }).base(
//   "appoEtN1RpO4eniQJ"
// );
// Airtable.configure({ apiKey: "keyaFQcjixVE9ngtN" });

// base("Table 1")
//   .select({
//     // Selecting the first 3 records in Grid view:
//     fields: ["id", "address", "earnings"],
//     view: "Grid view",
//   })
//   .eachPage(
//     function page(records, fetchNextPage) {
//       // This function (page) will get called for each page of records.
//       records.forEach(function (record) {
//         console.log(record.get("id"));
//       });
//       // To fetch the next page of records, call fetchNextPage.
//       // If there are more records, page will get called again.
//       // If there are no more records, done will get called.
//       fetchNextPage();
//     },
//     function done(err) {
//       if (err) {
//         console.error(err);
//         return;
//       }
//     }
//   );
