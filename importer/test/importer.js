const chai = require("chai");
chai.use(require("chai-http"));
const should = chai.should();
const expect = chai.expect;
const models = require("../models");
const AdmZip = require('adm-zip');
const logger = require("../config/winston");
const config = require('config');
const proxyquire = require('proxyquire');
const fs = require('fs').promises;
const nock = require('nock')
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt': { expressjwt(...args) { return (req, res, next)=>{return next();}}}})});

const ImporterUtils = require("../util/importer");
const Github = require("../util/github");

class Importer {
  
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
    let steplist = {"filename":file, "content":await ImporterUtils.openCSV(path, file)};
    let csvs = await this.getSteplistCSVs(steplist.content, path);
    let id = await ImporterUtils.steplistHash(steplist, csvs);
    let name = ImporterUtils.getName(steplist.filename);
    let res = await chai.request(testServerObject).post("/phenoflow/importer/importSteplist").send({steplist:steplist, csvs:csvs, name:name, about:ImporterUtils.getName(steplist.filename)+' - '+id, userName:author});
    return res;
  }

  static async addDefaultUser(restricted=false) {
    if(process.env.NODE_ENV && process.env.NODE_ENV=="test") await models.sequelize.sync({force:true});
    await models.user.create({name: "martinchapman", password: config.get("user.DEFAULT_PASSWORD"), verified: "true", homepage: "https://martinchapman.co.uk", restricted: restricted});
  };

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

describe("importer", () => {

  describe("/POST import", () => {
    
    before(async function() {
      this.timeout(0); 
      if(process.env.NODE_ENV && process.env.NODE_ENV=="test") await Github.clearAllRepos(); 
    })

    async function importJSONCodelist(codelist) {
      // Set up mocks in the order in which they will be called
      nock(config.get("parser.URL")).post("/phenoflow/parser/parseCodelists").reply(200, codelist);
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-disc.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-i2b2.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-omop.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-fhir.json", "utf8")));
      let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:Importer.getParsedCSVs(), name:"Imported codelist", about:"Imported codelist", userName:"martinchapman"});
      return res;
    }

    async function importCodelist() {
      return await importJSONCodelist(JSON.parse(await fs.readFile("test/fixtures/importer/parser/parseCodelists.json", "utf8"))) 
    }

    it("[IM1] Should be able to import a codelist.", async() => {
      await Importer.addDefaultUser();
      let res = await importCodelist();
      res.should.have.status(200);
      let workflows;
			try { workflows = await models.workflow.findAll(); } catch(error) { logger.error(error); };
			expect(workflows).to.have.lengthOf(4);
    }).timeout(0);

    it("[IM2] Should be able to import a zipped codelist.", async() => {
      await Importer.addDefaultUser();
      var zip = new AdmZip();
      for(let file of Importer.getCSVs()) zip.addFile(file.filename, Buffer.from(file.content, "utf8"));
      nock(config.get("parser.URL")).post("/phenoflow/parser/parseCodelists").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/parser/parseCodelists.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-disc.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-i2b2.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-omop.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-fhir.json", "utf8")));
      let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").attach('csvs', zip.toBuffer(), 'csvs.zip').field({name:"Imported codelist"}).field({about:"Imported codelist"}).field({userName:"martinchapman"});
      res.should.have.status(200);
      let workflows;
			try { workflows = await models.workflow.findAll(); } catch(error) { logger.error(error); };
			expect(workflows).to.have.lengthOf(4);
    }).timeout(0);

    it("[IM3] Should be able to import a steplist that references a branch.", async() => {
      await Importer.addDefaultUser();
      let steplist = 
        {"filename":"codelist-steplist-branch-A.csv",
          "content": [
            {"logicType": "codelist", "param": "listA_system.csv:1"},
            {"logicType": "branch", "param": "branch-a.csv"},
            {"logicType": "codelist", "param": "listB_system.csv:1"}
          ]
        };
      let csvs = Importer.getParsedCSVs().concat(Importer.getBranchCSVs());
      nock(config.get("parser.URL")).post("/phenoflow/parser/parseSteplist").reply(200, JSON.parse(await fs.readFile('test/fixtures/importer/parser/parseSteplist.json', 'utf8')));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchSteplist-disc.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchSteplist-i2b2.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchSteplist-omop.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchSteplist-fhir.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchSteplist-branchA.json", "utf8")));
      let res = await chai.request(testServerObject).post("/phenoflow/importer/importSteplist").send({steplist:steplist, csvs:csvs, name:ImporterUtils.getName(steplist.filename), about:ImporterUtils.getName(steplist.filename)+" - "+ImporterUtils.steplistHash(steplist, csvs), userName:"martinchapman"});
      res.should.have.status(200);
      let workflows;
			try { workflows = await models.workflow.findAll(); } catch(error) { logger.error(error); };
			expect(workflows).to.have.lengthOf(5);
      res.should.have.status(200);
    }).timeout(0);

    it("[IM4] Should be able to import a branch only steplist.", async() => {
      await Importer.addDefaultUser();
      let steplist = 
        {"filename":"codelist-steplist-branch-B.csv",
          "content": [
            {"logicType": "branch", "param": "branch-a.csv"},
            {"logicType": "branch", "param": "branch-b.csv"}
          ]
        };
      let csvs = Importer.getParsedCSVs().concat(Importer.getBranchCSVs());
      nock(config.get("parser.URL")).post("/phenoflow/parser/parseSteplist").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/parser/parseSteplist_branch-only.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchOnlySteplist-disc.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchOnlySteplist-i2b2.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchOnlySteplist-omop.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchOnlySteplist-fhir.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchOnlySteplist-branchA.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateBranchOnlySteplist-branchB.json", "utf8")));
      let res = await chai.request(testServerObject).post("/phenoflow/importer/importSteplist").send({steplist:steplist, csvs:csvs, name:ImporterUtils.getName(steplist.filename), about:ImporterUtils.getName(steplist.filename)+" - "+ImporterUtils.steplistHash(steplist, csvs), userName:"martinchapman"});
      res.should.have.status(200);
    }).timeout(0);

    it("[IM5] Should be able to import a keyword list.", async() => {
      await Importer.addDefaultUser();
      let keywords = {
        filename: "keywords.csv",
        content: [
          {"keyword": "TermA TermB"},
          {"keyword": "TermA TermC"},
          {"keyword": "TermD TermE"},
        ]
      };
      nock(config.get("parser.URL")).post("/phenoflow/parser/parseKeywordList").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/parser/parseKeywordList.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateKeywordList-disc.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateKeywordList-i2b2.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateKeywordList-omop.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateKeywordList-fhir.json", "utf8")));
      let res = await chai.request(testServerObject).post("/phenoflow/importer/importKeywordList").send({keywords:keywords, name:"Imported keywords", about:"Imported keywords", userName:"martinchapman"});
      res.should.have.status(200);
    }).timeout(0);

    it("[IM6] Should be able to add a connector.", async() => {
      await Importer.addDefaultUser();
      await importCodelist();
      nock(config.get("parser.URL")).post("/phenoflow/parser/parseStep").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/parser/parseStep.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateStep.json", "utf8")));
      let res = await chai.request(testServerObject).post("/phenoflow/importer/addConnector").set('content-type', 'application/json').attach("implementationTemplate", "templates/read-potential-cases.template.py", "read-potential-cases.template.py").field({"existingWorkflowIds":["7c131930-2d0b-11ed-8796-bf0bd96b6ffa"], "dataSource":"template", "language":"python", "newWorkflowId":"cb6853c0-6504-11ed-9773-c711ec3f673e"});
      res.should.have.status(200);
    }).timeout(0);

    it("[IM7] Workflows associated with restricted users should be private.", async() => {
      await Importer.addDefaultUser(true);
      nock(config.get("parser.URL")).post("/phenoflow/parser/parseCodelists").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/parser/parseCodelists.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-disc.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-i2b2.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-omop.json", "utf8")));
      nock(config.get("generator.URL")).post("/generate").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/generator/generateCodelists-fhir.json", "utf8")));
      let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:Importer.getParsedCSVs(), name:"Imported codelist", about:"Imported codelist", userName:"martinchapman"});
      res.should.have.status(200);
      let workflows;
			try { workflows = await models.workflow.findAll(); } catch(error) { logger.error(error); };
			expect(workflows).to.have.lengthOf(4);
    }).timeout(0);

    it("[IM8] Should be able to delete an imported codelist.", async() => {
      await Importer.addDefaultUser();
      let res = await importCodelist();
      res.should.have.status(200);
      let workflows;
			try { workflows = await models.workflow.findAll(); } catch(error) { logger.error(error); };
			expect(workflows).to.have.lengthOf(4);
      res = await chai.request(testServerObject).post("/phenoflow/importer/remove").send({id:workflows[1].id});
      res.should.have.status(200);
      try { workflows = await models.workflow.findAll(); } catch(error) { logger.error(error); };
			expect(workflows).to.have.lengthOf(0);
    }).timeout(0);

    it("[IM9] Should be able to clear partial imports.", async() => {
      await Importer.addDefaultUser();
      let codelist = JSON.parse(await fs.readFile("test/fixtures/importer/parser/parseCodelists.json", "utf8"));
      codelist = codelist.map(list=>Object.assign({}, list, {name: "Imported-codelist&"}));
      await importJSONCodelist(codelist);
      res = await chai.request(testServerObject).post("/phenoflow/importer/cleanup").send({});
      res.should.have.status(200);
			expect((await Github.getRepos()).data?.filter(repo=>repo.name.includes("---"))).to.have.lengthOf(0);
    }).timeout(0);
  
  });

});


module.exports = Importer;
