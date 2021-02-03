import gql from "graphql-tag";
import { Client } from "urql";

describe("Subgraph", () => {
  let graphqlClient: Client;
  beforeAll(() => {
    const SUBGRAPH_URL = "http://localhost:8000/subgraphs/name/1hive/vesting";
    graphqlClient = new Client({ url: SUBGRAPH_URL });
  });

  describe("Party data", () => {
    let data: any;

    const OFFER_QUERY = gql`
        query {
          
        }
      `;

    beforeAll(async () => {
      const { data } = await graphqlClient.query(OFFER_QUERY).toPromise();
    });

    test("returns the party data", () => {
      expect(data.id).toBe("");
    });
  });
});
