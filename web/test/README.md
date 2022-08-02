# Tests

Parsing tests.

NB: Tests that are used to populate local instances should be run in a development environment (i.e. without a `NODE_ENV=test` prefix).

## Example 1: Parsing from CALIBER

CALIBER (or the [HDR UK phenotype library](https://phenotypes.healthdatagateway.org/)) stores phenotype definitions as markdown files, each of which links to a set of codelists that form the definition.

To parse CALIBER definitions:

1. Clone [git@github.com:kclhi/hdr-caliber-phenome-portal.git](git@github.com:kclhi/hdr-caliber-phenome-portal.git) into [fixtures/parser/caliber](fixtures/parser/caliber).
2. Run `npx mocha -g "CI1|CI2"`
3. Run `npx mocha -g "IM7"`, to manually connect the definitions with different connectors.

## Example 2: Parsing from SAIL databank

[SAIL databank](https://saildatabank.com/) stores phenotypes remotely, as a part of a web library.

To parse SAIL definitions:

1. Inside [web/.env](web/.env) specify SAIL API credentials:

```
SAIL_USERNAME=
SAIL_PASSWORD=
```

2. Run `npx mocha -g "web"`
3. Run `npx mocha -g "IM7"`, to manually connect the definitions with different connectors.
