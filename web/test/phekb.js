const Importer = require("./importer");
const chai = require("chai");
chai.use(require("chai-http"));
const fs = require("fs").promises;
const config = require("config");
const models = require('../models');
const ImporterUtils = require("../util/importer");

async function importPhekbCodelists(path, files) {
  let csvs=[];
  for(let file of files) csvs.push({"filename":file, "content":await ImporterUtils.openCSV(path, file)});
  let id = await ImporterUtils.hash(csvs.map(csv=>csv.content));
  return await Importer.importCodelists(csvs, ImporterUtils.getName(files[0]), id+" - "+ImporterUtils.getName(files[0]), "phekb");
}

async function testPhekbCodelist(file) {
  const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
  // Can't perform test if file doesn't exist.
  try { await fs.stat(PATH) } catch(error) { return true; }
  let res = await importPhekbCodelists(PATH, [file]);
  res.body.should.be.a("object");
  res.should.have.status(200);
}

async function testPhekbSteplist(file) {
  const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
  try { await fs.stat(PATH) } catch(error) { return true; }
  let res = await Importer.processAndImportSteplist(PATH, file, "phekb");
  res.body.should.be.a("object");
  res.should.have.status(200);
}

describe("phekb importer", () => {

  describe("/POST import phekb csv", () => {

		it("[PI1] Should be able to add a new user.", async() => {
      const result = await models.user.findOrCreate({
        where: {name:"phekb"},
        defaults: {name:"phekb", password:config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://phekb.org"}
      });
			result.should.be.a("Array");
		});

    it("[PI2] Should be able to import a codelist.", async() => { 
      await testPhekbCodelist("abdominal-aortic-aneurysm-2_cpt.csv");
    }).timeout(0);

    it("[PI3] Should be able to import all codelists.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let phenotypeFiles = await fs.readdir(PATH);
      for(let phenotypeFile of phenotypeFiles) {
        console.log(phenotypeFile);
        if(phenotypeFile.includes("_rx") || phenotypeFile.includes("_lab") || phenotypeFile.includes("_key")) continue;
        let res = await importPhekbCodelists(PATH, [phenotypeFile]);
        res.body.should.be.a("object");
        res.should.have.status(200);
      }
    }).timeout(0);

    it("[PI4] Should be able to merge codelists.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      const FILE_A = "abdominal-aortic-aneurysm-2_cpt.csv";
      const FILE_B = "abdominal-aortic-aneurysm-2_icd.csv";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let res = await importPhekbCodelists(PATH, [FILE_A, FILE_B]);
      res.body.should.be.a("object");
      res.should.have.status(200);
    }).timeout(0);

    it("[PI5] Should be able to construct a phenotype from a list of steps.", async() => { 
      await testPhekbSteplist("abdominal-aortic-aneurysm-2.csv");
    }).timeout(0);

    it("[PI6] Phekb validation set.", async() => { 
      await testPhekbSteplist("abdominal-aortic-aneurysm-2.csv");
      await testPhekbCodelist("rheumatoid-arthritis_icd.csv");
      await testPhekbCodelist("rheumatoid-arthritis-2_icd.csv");
      await testPhekbCodelist("rheumatoid-arthritis-3_icd.csv");
      await testPhekbCodelist("type-2-diabetes_icd.csv");
      await testPhekbCodelist("type-2-diabetes-2_icd.csv");
      await testPhekbCodelist("type-2-diabetes-3_icd.csv");
    }).timeout(0);
    
  });

});
