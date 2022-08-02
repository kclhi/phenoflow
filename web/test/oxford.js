const chai = require("chai");
chai.use(require("chai-http"));
const fs = require("fs").promises;
const Parser = require("./parser");

async function testOxfordSteplist(file) {
  const PATH = "test/fixtures/parser/oxford/_data/codelists/";
  try { await fs.stat(PATH) } catch(error) { return true; }
  let res = await Parser.processAndParseSteplist(PATH, file, "oxford");
  res.body.should.be.an("array");
  res.should.have.status(200);
}

describe("oxford parser", () => {

  describe("/POST import oxford csv", () => {

    it("[OX1] Should be able to construct a phenotype from a list of steps.", async() => { 
      await testOxfordSteplist("long-covid.csv");
    }).timeout(0);

  });

});
