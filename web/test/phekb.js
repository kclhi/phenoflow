const Parser = require("./parser");
const chai = require("chai");
chai.use(require("chai-http"));
const fs = require("fs").promises;
const config = require("config");
const ParserUtils = require("../util/parser");

async function importPhekbCodelists(path, files) {
  let csvs=[];
  for(let file of files) csvs.push({"filename":file, "content":await ParserUtils.openCSV(path, file)});
  let id = await ParserUtils.hash(csvs.map(csv=>csv.content));
  return await Parser.parseCodelists(csvs, ParserUtils.getName(files[0]), id+" - "+ParserUtils.getName(files[0]), "phekb");
}

async function testPhekbCodelist(file) {
  const PATH = "test/"+config.get("parser.CODELIST_FOLDER")+"/_data/codelists/";
  // Can't perform test if file doesn't exist.
  try { await fs.stat(PATH) } catch(error) { return true; }
  let res = await importPhekbCodelists(PATH, [file]);
  res.body.should.be.a("array");
  res.should.have.status(200);
}

async function testPhekbSteplist(file) {
  const PATH = "test/"+config.get("parser.CODELIST_FOLDER")+"/_data/codelists/";
  try { await fs.stat(PATH) } catch(error) { return true; }
  let res = await Parser.processAndParseSteplist(PATH, file, "phekb");
  res.body.should.be.a("array");
  res.should.have.status(200);
}

describe("phekb parser", () => {

  describe("/POST import phekb csv", () => {

    it("[PI1] Should be able to parse a codelist.", async() => { 
      await testPhekbCodelist("abdominal-aortic-aneurysm-2_cpt.csv");
    }).timeout(0);

    it("[PI2] Should be able to parse all codelists.", async() => { 
      const PATH = "test/"+config.get("parser.CODELIST_FOLDER")+"/_data/codelists/";
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

    it("[PI3] Should be able to merge codelists.", async() => { 
      const PATH = "test/"+config.get("parser.CODELIST_FOLDER")+"/_data/codelists/";
      const FILE_A = "abdominal-aortic-aneurysm-2_cpt.csv";
      const FILE_B = "abdominal-aortic-aneurysm-2_icd.csv";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      let res = await importPhekbCodelists(PATH, [FILE_A, FILE_B]);
      res.body.should.be.a("object");
      res.should.have.status(200);
    }).timeout(0);

    it("[PI4] Should be able to construct a phenotype from a list of steps.", async() => { 
      await testPhekbSteplist("abdominal-aortic-aneurysm-2.csv");
    }).timeout(0);

    it("[PI5] Phekb validation set.", async() => { 
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
