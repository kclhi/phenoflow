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
      const FILE = "rheumatoid-arthritis-3_icd.csv";
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
        console.log(phenotypeFile);
        if(phenotypeFile.includes("_rx") || phenotypeFile.includes("_lab") || phenotypeFile.includes("_key")) continue;
        expect(await Importer.importCodelist(PATH, phenotypeFile, "phekb")).to.be.true;
      }
    }).timeout(0);

    it("[PI3] Should be able to merge codelists.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      const FILE_A = "abdominal-aortic-aneurysm-2_cpt.csv";
      const FILE_B = "abdominal-aortic-aneurysm-2_icd.csv";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      expect(await Importer.importCodelistMultiple(PATH, [FILE_A, FILE_B], "phekb")).to.be.true;
    }).timeout(0);

    it("[PI4] Should be able to construct a phenotype from a list of steps.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      const LIST = "abdominal-aortic-aneurysm-2.csv";
      try { await fs.stat(PATH) } catch(error) { return true; }
      expect(await Importer.importSteplist(PATH, LIST, "phekb")).to.be.true;
    }).timeout(0);

  });

});
