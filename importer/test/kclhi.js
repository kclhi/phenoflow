const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fs = require("fs").promises;
const models = require("../models");
const config = require("config");
const proxyquire = require('proxyquire');
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt': { expressjwt(...args) {return (req, res, next)=>{return next();}}}})});

const ImporterUtils = require("../util/importer");

async function importKCLHIKeywords(path, file) {
  
  let csv=[{"filename":file, "content":await ImporterUtils.openCSV(path, file)}];
  let id = await ImporterUtils.hash([csv.content]);
  return await chai.request(testServerObject).post("/phenoflow/importer/importKeywordList").send({keywords:{"filename":file, "content":await ImporterUtils.openCSV(path, file)}, name:ImporterUtils.getName(file), about:id+" - "+ImporterUtils.getName(file), userName:"kclhi"});

}

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
      let res = await importKCLHIKeywords(PATH, FILE);
      res.body.should.be.a("object");
      res.should.have.status(200);
    }).timeout(0);

    it("[KI3] Should be able to import all keyword lists.", async() => { 
      const PATH = "test/"+config.get("importer.KEYWORD_LIST_FOLDER")+"/_data/keywords/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let phenotypeFiles = await fs.readdir(PATH);
      for(let phenotypeFile of phenotypeFiles) {
        if(phenotypeFile.includes("_rx") || phenotypeFile.includes("_lab") || phenotypeFile.includes("_icd")) continue;
        let res = await importKCLHIKeywords(PATH, phenotypeFile);
        res.body.should.be.a("object");
        res.should.have.status(200);
      }
    }).timeout(0);

  });

});
