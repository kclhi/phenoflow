const Importer = require("./importer");
const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fsfull = require("fs");
const fs = require("fs").promises;
const proxyquire = require('proxyquire');
const m2js = require("markdown-to-json");
const parse = require('neat-csv');
const models = require("../models");
const config = require("config");
const workflowUtils = require("../util/workflow");

describe("phekb importer", () => {

  describe("/POST import phekb csv", () => {

    it("[PI1] Should be able to import a codelist.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      const FILE = "acute-cutaneous-lupus_icd.csv";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      expect(await Importer.importCodelist(PATH, FILE, "phekb")).to.be.true;
    }).timeout(0);

    it("[PI2] Should be able to import all codelists.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let phenotypeFiles = await fs.readdir(PATH);
      for(let phenotypeFile of phenotypeFiles) {
        if(phenotypeFile.includes("_rx") || phenotypeFile.includes("_lab") || phenotypeFile.includes("_key")) continue;
        expect(await Importer.importCodelist(PATH, phenotypeFile, "phekb")).to.be.true;
      }
    }).timeout(0);

  });

});
