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

describe("kclhi importer", () => {

  describe("/POST import kclhi keywords", () => {

    it("[KI1] Should be able to add a new user.", async() => {
			const result = await models.user.create({name:"kclhi", password:config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://kclhi.org"});
			result.should.be.a("object");
		});

    it("[KI2] Should be able to import a keyword list.", async() => { 
      const PATH = "test/"+config.get("importer.KEYWORD_LIST_FOLDER")+"/_data/keywords/";
      const FILE = "stroke_key.csv";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      expect(await Importer.importKeywordList(PATH, FILE, "kclhi")).to.be.true;
    }).timeout(0);

    it("[KI3] Should be able to import all keyword lists.", async() => { 
      const PATH = "test/"+config.get("importer.KEYWORD_LIST_FOLDER")+"/_data/keywords/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let phenotypeFiles = await fs.readdir(PATH);
      for(let phenotypeFile of phenotypeFiles) {
        if(phenotypeFile.includes("_rx") || phenotypeFile.includes("_lab") || phenotypeFile.includes("_icd")) continue;
        expect(await Importer.importKeywordList(PATH, phenotypeFile, "kclhi")).to.be.true;
      }
    }).timeout(0);

  });

});
