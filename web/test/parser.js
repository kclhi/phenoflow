const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const proxyquire = require('proxyquire');
const testServerObject = proxyquire('../app', {'./routes/parser':proxyquire('../routes/parser', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
const ParserUtils = require("../util/parser");
const AdmZip = require('adm-zip');

class Parser {

  static async parseSteplist(steplist, csvs, name, about, userName) {
    let res = await chai.request(testServerObject).post("/phenoflow/parser/parseSteplist").send({steplist:steplist, csvs:csvs, name:name, about:about, userName:userName});
    return res;
  }

  static async parseKeywordList(keywords, name, about, userName) {
    let res = await chai.request(testServerObject).post("/phenoflow/parser/parseKeywordList").send({keywords:keywords, name:name, about:about, userName:userName});
    return res;
  }

  static getCSVs() {
    return [
      {"filename":"listA_system.csv",
      "content": "ICD-10 code,description\n123,TermA TermB\n234,TermA TermC\n345,TermD TermE"},
      {"filename":"listB_system.csv",
      "content": "SNOMED code,description\n456,TermF TermG\n567,TermF TermH\n678,TermI TermJ"},
      {"filename":"listC_system.csv",
      "content": "SNOMED code,description\n456,TermK TermL\n567,TermK TermL\n678,TermK TermL"},
      {"filename":"listD_system.csv",
      "content": "SNOMED code,description\n456,TermM TermN\n567,TermM TermN\n678,TermM TermN"}
    ]
  }

  static getParsedCSVs() {
    return [
      {"filename":"listA_system.csv",
      "content": [
        {"ICD-10 code": "123", "description": "TermA TermB"},
        {"ICD-10 code": "234", "description": "TermA TermC"},
        {"ICD-10 code": "345", "description": "TermD TermE"}
      ]},
      {"filename":"listB_system.csv",
      "content": [
        {"SNOMED code": "456", "description": "TermF TermG"},
        {"SNOMED code": "567", "description": "TermF TermH"},
        {"SNOMED code": "678", "description": "TermI TermJ"}
      ]},
      {"filename":"listC_system.csv",
      "content": [
        {"SNOMED code": "456", "description": "TermK TermL"},
        {"SNOMED code": "567", "description": "TermK TermL"},
        {"SNOMED code": "678", "description": "TermK TermL"}
      ]},
      {"filename":"listD_system.csv",
      "content": [
        {"SNOMED code": "456", "description": "TermM TermN"},
        {"SNOMED code": "567", "description": "TermM TermN"},
        {"SNOMED code": "678", "description": "TermM TermN"}
      ]}
    ]
  }

  static getBranchCSVs() {
    return [
      {"filename":"branch-a.csv",
      "content": [
        {"logicType": "codelist", "param": "listA_system.csv:1"},
        {"logicType": "codelist", "param": "listB_system.csv:1"},
      ]},
      {"filename":"branch-b.csv",
      "content": [
        {"logicType": "codelistExclude", "param": "listC_system.csv:1"},
        {"logicType": "codelist", "param": "listD_system.csv:1"},
      ]}
    ];
  }

}

describe("parser", () => {

  describe("/POST import", () => {

    it("[PA1] Common terms should be grouped by category.", async() => {
      let categories = ParserUtils.getCategories([{"filename":"file.csv", 
        "content": [
          {"ICD-10 code": "123", "description": "TermA TermB"},
          {"ICD-10 code": "234", "description": "TermA TermC"},
          {"ICD-10 code": "345", "description": "TermD TermE"}
        ]
      }], "Phenotype");
      categories.should.have.property("Phenotype terma - secondary");
      categories.should.have.property("Phenotype - secondary");
      categories["Phenotype terma - secondary"].should.be.a("Array");
      categories["Phenotype - secondary"].should.be.a("Array");
      categories["Phenotype terma - secondary"].should.deep.equal(['123','234']);
      categories["Phenotype - secondary"].should.deep.equal(['345']);
    }).timeout(0);
    
    it("[PA2] Should be able to parse a codelist.", async() => {
      let res = await chai.request(testServerObject).post("/phenoflow/parser/parseCodelists").send({csvs:Parser.getParsedCSVs(), name:"Parsed codelist", about:"Parsed codelist", userName:"martinchapman"});
      res.should.have.status(200);
    }).timeout(0);

    it("[PA3] Should be able to parse a zipped codelist.", async() => {
      var zip = new AdmZip();
      for(let file of Parser.getCSVs()) zip.addFile(file.filename, Buffer.from(file.content, "utf8"));
      let res = await chai.request(testServerObject).post("/phenoflow/parser/parseCodelists").attach('csvs', zip.toBuffer(), 'csvs.zip').field({name:"Parsed codelist"}).field({about:"Parsed codelist"}).field({userName:"martinchapman"});
      res.should.have.status(200);
    }).timeout(0);

    it("[PA4] Should be able to parse a steplist that references a branch.", async() => {
      let stepList = 
        {"filename":"codelist-steplist-branch-A.csv",
          "content": [
            {"logicType": "codelist", "param": "listA_system.csv:1"},
            {"logicType": "branch", "param": "branch-a.csv"},
            {"logicType": "codelist", "param": "listB_system.csv:1"}
          ]
        };
      let csvs = Parser.getParsedCSVs().concat(Parser.getBranchCSVs());
      let res = await Parser.parseSteplist(stepList, csvs, ParserUtils.getName(stepList.filename), ParserUtils.steplistHash(stepList, csvs)+" - "+ParserUtils.getName(stepList.filename), "martinchapman");
      res.should.have.status(200);
    }).timeout(0);

    it("[PA5] Should be able to parse a branch only steplist.", async() => {
      let stepList = 
        {"filename":"codelist-steplist-branch-B.csv",
          "content": [
            {"logicType": "branch", "param": "branch-a.csv"},
            {"logicType": "branch", "param": "branch-b.csv"}
          ]
        };
      let csvs = Parser.getCSVs().concat(Parser.getBranchCSVs());
      let res = await Parser.parseSteplist(stepList, csvs, ParserUtils.getName(stepList.filename), ParserUtils.steplistHash(stepList, csvs)+" - "+ParserUtils.getName(stepList.filename), "martinchapman");
      res.should.have.status(200);
    }).timeout(0);

    it("[PA6] Should be able to parse a keyword list.", async() => {
      let keywords = {
        filename: "keywords.csv",
        content: [
          {"keyword": "TermA TermB"},
          {"keyword": "TermA TermC"},
          {"keyword": "TermD TermE"},
        ]
      };
      let res = await Parser.parseKeywordList(keywords, "Imported keywords", "Imported keywords", "martinchapman");
      res.should.have.status(200);
    }).timeout(0);
  
  });

});

module.exports = Parser;
