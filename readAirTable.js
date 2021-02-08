var Airtable = require("airtable");
var base = new Airtable({ apiKey: "keyaFQcjixVE9ngtN" }).base(
  "appoEtN1RpO4eniQJ"
);
Airtable.configure({ apiKey: "keyaFQcjixVE9ngtN" });

base("Table 1")
  .select({
    fields: ["id", "account", "amount"],
    view: "Grid view",
  })
  .eachPage(
    function page(records, fetchNextPage) {
      records.forEach(function (record) {
        console.log(record.get("id"));
      });
      fetchNextPage();
    },
    function done(err) {
      if (err) {
        console.error(err);
        return;
      }
    }
  );
