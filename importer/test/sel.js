const chai = require("chai");
chai.use(require("chai-http"));
const models = require("../models");
const config = require("config");
const proxyquire = require('proxyquire');
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});

const ImporterUtils = require("../util/importer");

async function importSELPhenotype(codelist, name) {

  let csv = {"filename":codelist, "content":await ImporterUtils.openCSV("test/"+config.get("importer.BASE_FOLDER")+"/sel/", codelist)};
  let id = await ImporterUtils.hash([csv.content]);
  let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:[csv], name:name, about:name + " - " + id, userName:"South East London (SEL) Long COVID Programme"});
  res.should.be.a("object");
  res.should.have.status(200);
  
}


describe("SEL Long COVID Programme (Lambeth Data Workstream) importer", () => {

  describe("/POST import sel csv", () => {

    it("[SE1] Should be able to add a new user (CSVs).", async() => {
      const result = await models.user.create({name:"South East London (SEL) Long COVID Programme", password: config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://www.kingshealthpartners.org/latest/3896-south-east-london-long-covid-programme"});
      result.should.be.a("object");
    });
    
    it("[SE2] Should be able to import a phenotype CSV.", async() => {
      await importSELPhenotype("anx.csv", "Anxiety Disorders");
      await importSELPhenotype("covid.csv", "Covid");
      await importSELPhenotype("dep.csv", "Depression");
      await importSELPhenotype("dm.csv", "Diabetes");
      await importSELPhenotype("long_covid.csv", "Long covid");
      await importSELPhenotype("obese.csv", "Obesity");
    }).timeout(0);

  });

});
