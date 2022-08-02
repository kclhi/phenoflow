const Parser = require("./parser");
const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fs = require("fs").promises;
const config = require("config");
const ParserUtils = require("../util/parser");

async function parseKCLHIKeywords(path, file) {
  
  let content = await ParserUtils.openCSV(path, file);
  let id = await ParserUtils.hash(content);
  return await Parser.parseKeywordList({"filename":file, "content":content}, ParserUtils.getName(file), id+" - "+ParserUtils.getName(file), "kclhi");

}

describe("kclhi parser", () => {

  describe("/POST parse kclhi keywords", () => {

    it("[KI1] Should be able to parse a keyword list.", async() => { 
      const PATH = "test/"+config.get("parser.KEYWORD_LIST_FOLDER")+"/_data/keywords/";
      const FILE = "stroke_key.csv";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let res = await parseKCLHIKeywords(PATH, FILE);
      res.body.should.be.an("array");
      res.should.have.status(200);
    }).timeout(0);

    it("[KI2] Should be able to parse all keyword lists.", async() => { 
      const PATH = "test/"+config.get("parser.KEYWORD_LIST_FOLDER")+"/_data/keywords/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let phenotypeFiles = await fs.readdir(PATH);
      for(let phenotypeFile of phenotypeFiles) {
        if(phenotypeFile.includes("_rx") || phenotypeFile.includes("_lab") || phenotypeFile.includes("_icd")) continue;
        let res = await parseKCLHIKeywords(PATH, phenotypeFile);
        res.body.should.be.an("array");
        res.should.have.status(200);
      }
    }).timeout(0);

  });

});
