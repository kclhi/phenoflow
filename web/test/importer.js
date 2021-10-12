const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const proxyquire = require('proxyquire');
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
const models = require("../models");
const WorkflowUtils = require("../util/workflow")

class Importer {

  static async importCodelists(csvs, name, about, userName) {
    
    let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:csvs, name:name, about:about, userName:userName});
    return res;

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
  
  });

});

module.exports = Importer;
