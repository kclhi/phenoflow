const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const proxyquire = require('proxyquire');
const testServerObject = proxyquire('../app', {'./routes/parser':proxyquire('../routes/parser', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
const ParserUtils = require("../util/parser");

class Parser {

  static async parseCodelists(csvs, name, about, userName) {
    let res = await chai.request(testServerObject).post("/phenoflow/parser/parseCodelists").send({csvs:csvs, name:name, about:about, userName:userName});
    return res;
  }

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

    it("[IM1] Common terms should be grouped by category.", async() => {
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
    
    it("[IM2] Should be able to parse a codelist.", async() => {
      let res = await Parser.parseCodelists(Parser.getCSVs(), "Imported codelist", "Imported codelist", "martinchapman");
      res.should.have.status(200);
    }).timeout(0);

    it("[IM3] Should be able to parse a steplist that references a branch.", async() => {
      let stepList = 
        {"filename":"codelist-steplist-branch-A.csv",
          "content": [
            {"logicType": "codelist", "param": "listA_system.csv:1"},
            {"logicType": "branch", "param": "branch-a.csv"},
            {"logicType": "codelist", "param": "listB_system.csv:1"}
          ]
        };
      let csvs = Parser.getCSVs().concat(Parser.getBranchCSVs());
      let res = await Parser.parseSteplist(stepList, csvs, ParserUtils.getName(stepList.filename), ParserUtils.steplistHash(stepList, csvs)+" - "+ParserUtils.getName(stepList.filename), "martinchapman");
      res.should.have.status(200);
    }).timeout(0);

    it("[IM4] Should be able to parse a branch only steplist.", async() => {
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

    it("[IM5] Should be able to parse a keyword list.", async() => {
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
