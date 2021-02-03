import gql from "graphql-tag";
import { Client } from "urql";

describe("Subgraph", () => {
  let graphqlClient: Client;
  beforeAll(() => {
    const SUBGRAPH_URL = "http://localhost:8000/subgraphs/name/1hive/vested";
    graphqlClient = new Client({ url: SUBGRAPH_URL });
  });

  describe("Offer data", () => {
    let data: any;

    const OFFER_QUERY = gql`
        query {
          
        }
      `;

    beforeAll(async () => {
      const { data } = await graphqlClient.query(OFFER_QUERY).toPromise();
    });

    test("returns the offer data", () => {
      expect(data.id).toBe("");
    });
  });
});
