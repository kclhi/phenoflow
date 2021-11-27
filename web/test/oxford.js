const chai = require("chai");
chai.use(require("chai-http"));
const fs = require("fs").promises;
const config = require("config");
const models = require('../models');
const Importer = require("./importer");

async function testOxfordSteplist(file) {
  const PATH = "test/fixtures/importer/oxford/_data/codelists/";
  try { await fs.stat(PATH) } catch(error) { return true; }
  let res = await Importer.processAndImportSteplist(PATH, file, "oxford");
  res.body.should.be.a("object");
  res.should.have.status(200);
}

describe("oxford importer", () => {

  describe("/POST import oxford csv", () => {

		it("[OX1] Should be able to add a new user.", async() => {
      const result = await models.user.findOrCreate({
        where: {name:"oxford"},
        defaults: {name:"oxford", password:config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://orchid.phc.ox.ac.uk/", restricted:true}
      });
			result.should.be.a("Array");
		}).timeout(0);

    it("[OX2] Should be able to construct a phenotype from a list of steps.", async() => { 
      await testOxfordSteplist("long-covid.csv");
    }).timeout(0);

  });

});
