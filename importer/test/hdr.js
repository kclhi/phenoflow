const chai = require("chai");
chai.use(require("chai-http"));
const should = chai.should();
const expect = chai.expect;
const got = require("got");
const proxyquire = require('proxyquire');
const models = require("../models");
const logger = require("../config/winston");
const config = require("config");
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});

describe("hdr", () => {

  describe("/POST import hdr", () => {

    async function addUser(name, homepage=config.get("phenoflow.HOMEPAGE")) {
      try {
        const result = await models.user.findOrCreate({
          where: {name:name},
          defaults: {name:name, password:config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:homepage}
        });
        result.should.be.a("Array");
      } catch(addUserError) {
        logger.error("Error adding user: " + addUserError);
        return false;
      }
      return true;
    }

    async function getAllPhenotypesHDR() {
      try {
        let phenotypes = await got.get(config.get("importer.HDR_API") + "/public/phenotypes/?format=json", {responseType:"json"});
        return phenotypes.body;
      } catch(getAllPhenotypesError) {
        logger.error("Error getting all phenotypes: " + getAllPhenotypesError);
        return [];
      }
    }

    async function importAllPhenotypesHDR() {
      for(let phenotype of await getAllPhenotypesHDR()) {
        try {
          await importPhenotypeHDR(phenotype);
        } catch(importPhenotypeError) {
          logger.error("Error importing phenotype: " + importPhenotypeError);
          return false;
        }
      }
      return true;
    }

    async function importPhenotypeHDR(phenotype) {
      let allCSVs;
      try {
        allCSVs = await got.get(config.get("importer.HDR_API") + "/public/phenotypes/" + phenotype.phenotype_id + "/export/codes/?format=json", {responseType:"json"});
      } catch(getCodelistsError) {
        logger.error("Error getting codelist from phenotype: " + getCodelistsError);
        return false;
      }
      try {
        allCSVs = allCSVs.body.reduce((b, a) => { b[a.coding_system] = (b[a.coding_system]??[]).concat([{[a.coding_system.replace("codes", "code")]:a.code, "description":a.description.replace(/\(.*\)/,"")}]); return b; }, {});
      } catch(formatCodelistError) {
        logger.error("Error formatting codelist: " + formatCodelistError);
        return false;
      }
      allCSVs = Object.entries(allCSVs).map(codelist=>({"filename":phenotype.phenotype_name.replaceAll(" ", "_") + "_" + phenotype.phenotype_id + "_" + codelist[0].replaceAll(" ", "_"), "content":codelist[1]}));
      if(!await addUser(phenotype.author)) return false;
      let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:allCSVs, name:phenotype.phenotype_name, about:phenotype.phenotype_name + " - " + phenotype.phenotype_id, userName:phenotype.author});
      res.should.be.a("object");
      res.should.have.status(200);
      return true;
    }

    it("[HDR1] Should be able to import a phenotype from the HDR UK phenotype library API", async () => {
      let allPhenotypes = (await getAllPhenotypesHDR()).filter(phenotype=>phenotype.phenotype_id.includes("PH969"));
      expect(await importPhenotypeHDR(allPhenotypes[0])).to.be.true;
    }).timeout(0);

    it("[HDR2] Should be able to import a subset of phenotypes from the HDR UK phenotype library API", async () => {
      let allPhenotypes = await getAllPhenotypesHDR();
      let allPhenotypesShuffled = allPhenotypes
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value)
      for(let phenotype = 0; phenotype < Math.min(5, allPhenotypesShuffled.length); phenotype++) {
        expect(await importPhenotypeHDR(allPhenotypesShuffled[phenotype])).to.be.true;
      }
    }).timeout(0);

    it("[HDR3] Should be able to import all phenotypes from the HDR UK phenotype library API", async () => {
      expect(await importAllPhenotypesHDR()).to.be.true;
    }).timeout(0);

  });

});
