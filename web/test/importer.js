const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const proxyquire = require('proxyquire');
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
const models = require("../models");
const WorkflowUtils = require("../util/workflow")
const ImporterUtils = require("../util/importer");

class Importer {

  static async importCodelists(csvs, name, about, userName) {
    let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:csvs, name:name, about:about, userName:userName});
    return res;
  }
  
  static async processAndImportSteplist(path, file, author) {
    let stepList = {"filename":file, "content":await ImporterUtils.openCSV(path, file)};
    let csvs = [];
    for(let row of stepList.content) {
      if(row["logicType"]=="codelist"||row["logicType"]=="codelistExclude") {
        let file = row["param"].split(":")[0];
        csvs.push({"filename":file, "content": await ImporterUtils.openCSV(path, file)});
      } else if(row["logicType"]=="codelistsTemporal"||row["logicType"]=="codelistExcludeInclude"||row["logicType"]=="codelistPreviousExclude"||row["logicType"]=="codelistPreviousInclude") {
        for(let file of [row["param"].split(":")[0], row["param"].split(":")[1]]) csvs.push({"filename":file, "content": await ImporterUtils.openCSV(path, file)});
      }
    }
    let uniqueCSVs = csvs.filter(({filename}, index)=>!csvs.map(csv=>csv.filename).includes(filename, index+1));
    let id = await ImporterUtils.hashFiles(path, uniqueCSVs.map((csv)=>csv.filename));
    let name = ImporterUtils.getName(stepList.filename);
    return await this.importSteplist(stepList, csvs, name, id+" - "+ImporterUtils.getName(stepList.filename), author);
  }

  static async importSteplist(steplist, csvs, name, about, userName) {
    let res = await chai.request(testServerObject).post("/phenoflow/importer/importSteplist").send({steplist:steplist, csvs:csvs, name:name, about:about, userName:userName});
    return res;
  }

  static async importKeywordList(keywords, name, about, userName) {
    let res = await chai.request(testServerObject).post("/phenoflow/importer/importKeywordList").send({keywords:keywords, name:name, about:about, userName:userName});
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
        {"ICD-10 code": "456", "description": "TermF TermG"},
        {"ICD-10 code": "567", "description": "TermF TermH"},
        {"ICD-10 code": "678", "description": "TermI TermJ"}
      ]}
    ]
  }

}

describe("importer", () => {

  describe("/POST import", () => {

    it("[IM1] Common terms should be grouped by category.", async() => {
      let categories = ImporterUtils.getCategories([{"filename":"file.csv", 
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
    
    it("[IM2] Should be able to import a codelist.", async() => {
      await Importer.importCodelists(Importer.getCSVs(), "Imported codelist", "Imported codelist", "martinchapman");
    }).timeout(0);

    it("[IM3] Should be able to import a 'codelistExcludeInclude' steplist.", async() => {
      let stepList = 
        {"filename":"codelistExcludeInclude-steplist.csv",
          "content": [
            {"logicType": "codelistExcludeInclude", "param": "listA_system.csv:listB_system.csv"}
          ]
        };
      await Importer.importSteplist(stepList, Importer.getCSVs(), ImporterUtils.getName(stepList.filename), ImporterUtils.hash(Importer.getCSVs().map(csv=>csv.content).join(""))+" - "+ImporterUtils.getName(stepList.filename), "martinchapman");
    }).timeout(0);

    it("[IM4] Should be able to import a 'codelistPreviousExclude' steplist.", async() => {
      let stepList = 
        {"filename":"codelistPreviousExclude-steplist.csv",
          "content": [
            {"logicType": "codelistPreviousExclude", "param": "listA_system.csv:listB_system.csv"}
          ]
        };
      await Importer.importSteplist(stepList, Importer.getCSVs(), ImporterUtils.getName(stepList.filename), ImporterUtils.hash(Importer.getCSVs().map(csv=>csv.content).join(""))+" - "+ImporterUtils.getName(stepList.filename), "martinchapman");
    }).timeout(0);

    it("[IM5] Should be able to import a 'codelistPreviousInclude' steplist.", async() => {
      let stepList = 
        {"filename":"codelistPreviousInclude-steplist.csv",
          "content": [
            {"logicType": "codelistPreviousInclude", "param": "listA_system.csv:listB_system.csv"}
          ]
        };
      await Importer.importSteplist(stepList, Importer.getCSVs(), ImporterUtils.getName(stepList.filename), ImporterUtils.hash(Importer.getCSVs().map(csv=>csv.content).join(""))+" - "+ImporterUtils.getName(stepList.filename), "martinchapman");
    }).timeout(0);

    it("[IM6] Should be able to import a keyword list.", async() => {
      let keywords = {
        filename: "keywords.csv",
        content: [
          {"keyword": "keywordA", "case_incl": "Y"},
          {"keyword": "keywordB", "case_incl": "Y"},
          {"keyword": "keywordC", "case_incl": "Y"},
        ]
      };
      await Importer.importKeywordList(keywords, "Imported keywords", "Imported keywords", "martinchapman");
    }).timeout(0);

    it("[IM7] Create children for imported phenotypes.", async() => {
      for(let workflow of await models.workflow.findAll({where:{complete:true}, order:[['createdAt', 'DESC']]})) await WorkflowUtils.workflowChild(workflow.id);
    }).timeout(0);
  
  });

});

module.exports = Importer;
