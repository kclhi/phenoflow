const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const proxyquire = require('proxyquire');
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});

class Importer {

  static async importCodelists(csvs, name, about, userName) {
    
    let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:csvs, name:name, about:about, userName:userName});
    return res;

  }

  static async importSteplist(steplist, csvs, userName) {

    let res = await chai.request(testServerObject).post("/phenoflow/importer/importSteplist").send({steplist:steplist, csvs:csvs, userName:userName});
    return res;

  }

  static async importKeywordList(keywords, userName) {
    
    let res = await chai.request(testServerObject).post("/phenoflow/importer/importKeywordList").send({keywords:keywords, userName:userName});
    return res;

  }

}

module.exports = Importer;
