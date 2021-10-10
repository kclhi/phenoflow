const Importer = require("./importer");
const chai = require("chai");
chai.use(require("chai-http"));
const fs = require("fs").promises;
const config = require("config");
const importerUtils = require("../util/importer");

async function importPhekbCSVs(path, files) {
  
  let csvs=[];
  for(let file of files) csvs.push({"filename":file, "content":await importerUtils.openCSV(path, file)});
  return await Importer.importCodelists(csvs, null, null, "phekb");

}

async function importPhekbSteplist(path, file) {
  
  let stepList = {"filename":file, "content":await importerUtils.openCSV(path, file)};
  let csvs = [];
  for(let row of stepList.content) {
    if(row["logicType"]=="codelist") {
      let file = row["param"].split(":")[0];
      csvs.push({"filename":file, "content": await importerUtils.openCSV(path, file)});
    }
  }
  return await Importer.importSteplist(stepList, csvs, "phekb");

}

describe("phekb importer", () => {

  describe("/POST import phekb csv", () => {

    it("[PI1] Should be able to import a codelist.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      const FILE = "rheumatoid-arthritis-3_icd.csv";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let res = await importPhekbCSVs(PATH, [FILE]);
      res.body.should.be.a("object");
      res.should.have.status(200);
    }).timeout(0);

    it("[PI2] Should be able to import all codelists.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let phenotypeFiles = await fs.readdir(PATH);
      for(let phenotypeFile of phenotypeFiles) {
        console.log(phenotypeFile);
        if(phenotypeFile.includes("_rx") || phenotypeFile.includes("_lab") || phenotypeFile.includes("_key")) continue;
        let res = await importPhekbCSVs(PATH, [phenotypeFile]);
        res.body.should.be.a("object");
        res.should.have.status(200);
      }
    }).timeout(0);

    it("[PI3] Should be able to merge codelists.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      const FILE_A = "abdominal-aortic-aneurysm-2_cpt.csv";
      const FILE_B = "abdominal-aortic-aneurysm-2_icd.csv";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let res = await importPhekbCSVs(PATH, [FILE_A, FILE_B]);
      res.body.should.be.a("object");
      res.should.have.status(200);
    }).timeout(0);

    it("[PI4] Should be able to construct a phenotype from a list of steps.", async() => { 
      const PATH = "test/"+config.get("importer.CODELIST_FOLDER")+"/_data/codelists/";
      const LIST = "abdominal-aortic-aneurysm-2.csv";
      try { await fs.stat(PATH) } catch(error) { return true; }
      let res = await importPhekbSteplist(PATH, LIST);
      res.body.should.be.a("object");
      res.should.have.status(200);
    }).timeout(0);

  });

});
