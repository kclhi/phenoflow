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
  
  static async getSteplistCSVs(stepList, path) {
    let csvs = [];
    for(let row of stepList) {
      if(row["logicType"]=="codelist"||row["logicType"]=="codelistExclude") {
        let file = row["param"].split(":")[0];
        csvs.push({"filename":file, "content": await ImporterUtils.openCSV(path, file)});
      } else if(row["logicType"]=="codelistsTemporal") {
        for(let file of [row["param"].split(":")[0], row["param"].split(":")[1]]) csvs.push({"filename":file, "content": await ImporterUtils.openCSV(path, file)});
      } else if(row["logicType"]=="branch") {
        let nestedSteplist = await ImporterUtils.openCSV(path, row["param"]);
        csvs.push({"filename":row["param"], "content":nestedSteplist});
        csvs = csvs.concat(await this.getSteplistCSVs(nestedSteplist, path));
      }
    }
    return csvs;
  }
  
  static async processAndImportSteplist(path, file, author) {
    let stepList = {"filename":file, "content":await ImporterUtils.openCSV(path, file)};
    let csvs = await this.getSteplistCSVs(stepList.content, path);
    let id = await ImporterUtils.steplistHash(stepList, csvs);
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
      let res = await Importer.importCodelists(Importer.getCSVs(), "Imported codelist", "Imported codelist", "martinchapman");
      res.should.have.status(200);
    }).timeout(0);

    it("[IM3] Should be able to import a steplist that references a branch.", async() => {
      let stepList = 
        {"filename":"codelist-steplist-branch-A.csv",
          "content": [
            {"logicType": "codelist", "param": "listA_system.csv:1"},
            {"logicType": "branch", "param": "branch-a.csv"},
            {"logicType": "codelist", "param": "listB_system.csv:1"}
          ]
        };
      let csvs = Importer.getCSVs().concat(Importer.getBranchCSVs());
      let res = await Importer.importSteplist(stepList, csvs, ImporterUtils.getName(stepList.filename), ImporterUtils.steplistHash(stepList, csvs)+" - "+ImporterUtils.getName(stepList.filename), "martinchapman");
      res.should.have.status(200);
    }).timeout(0);

    it("[IM4] Should be able to import a branch only steplist.", async() => {
      let stepList = 
        {"filename":"codelist-steplist-branch-B.csv",
          "content": [
            {"logicType": "branch", "param": "branch-a.csv"},
            {"logicType": "branch", "param": "branch-b.csv"}
          ]
        };
      let csvs = Importer.getCSVs().concat(Importer.getBranchCSVs());
      let res = await Importer.importSteplist(stepList, csvs, ImporterUtils.getName(stepList.filename), ImporterUtils.steplistHash(stepList, csvs)+" - "+ImporterUtils.getName(stepList.filename), "martinchapman");
      res.should.have.status(200);
    }).timeout(0);

    it("[IM5] Should be able to import a keyword list.", async() => {
      let keywords = {
        filename: "keywords.csv",
        content: [
          {"keyword": "TermA TermB"},
          {"keyword": "TermA TermC"},
          {"keyword": "TermD TermE"},
        ]
      };
      let res = await Importer.importKeywordList(keywords, "Imported keywords", "Imported keywords", "martinchapman");
      res.should.have.status(200);
    }).timeout(0);

    it("[IM6] Should be able to add a connector.", async() => {
      let res = await chai.request(testServerObject).post("/phenoflow/importer/addConnector").attach("implementationTemplate", "templates/read-potential-cases.template.py", "read-potential-cases.template.py").field({"existingWorkflowIds":[1], "dataSource":"template", "language":"python"});
      res.should.have.status(200);
    }).timeout(0);

    it("[IM7] Create children for imported phenotypes.", async() => {
      for(let workflow of await models.workflow.findAll({where:{complete:true}, order:[['createdAt', 'DESC']]})) await WorkflowUtils.workflowChild(workflow.id);
    }).timeout(0);
  
  });

});

module.exports = Importer;
