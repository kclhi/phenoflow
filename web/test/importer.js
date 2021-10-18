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
      if(row["logicType"]=="codelist") {
        let file = row["param"].split(":")[0];
        csvs.push({"filename":file, "content": await ImporterUtils.openCSV(path, file)});
      } else if(row["logicType"]=="codelistsTemporal"||row["logicType"]=="codelistExclude") {
        for(let file of [row["param"].split(":")[0], row["param"].split(":")[1]]) csvs.push({"filename":file, "content": await ImporterUtils.openCSV(path, file)});
      }
    }
    let id = await ImporterUtils.hashFiles(path, csvs.map((csv)=>csv.filename));
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

}

describe("importer", () => {

  describe("/POST import", () => {

    it("[IM1] Create children for imported phenotypes.", async() => {
      for(let workflow of await models.workflow.findAll({where:{complete:true}, order:[['createdAt', 'DESC']]})) await WorkflowUtils.workflowChild(workflow.id);
    }).timeout(0);

    it("[IM2] Common terms should be grouped by category.", async() => {
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
  
  });

});

module.exports = Importer;
