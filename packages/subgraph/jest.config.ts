const packageName = require("./package.json")
  .name.split("@scaffold-eth/")
  .pop();

export const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 10000,
  displayName: "SUBGRAPH",
  roots: [`<rootDir>/packages/${packageName}`],
  modulePaths: [`<rootDir>/packages/${packageName}/src/`],
  rootDir: "../..",
};
