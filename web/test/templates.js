
const chai = require("chai");
chai.use(require("chai-http"));
const expect = chai.expect;
const got = require("got");
const fs = require("fs").promises;
const { PythonShell: shell } = require("python-shell");
const spawn = require("await-spawn");
const parse = require('neat-csv');

async function runJSCode(source, input="") {
  try {
    const shell = await spawn('node', ['-e', source, "programme", input]);
    return shell.toString();
  } catch (exception) {
    let issue = exception.stderr.toString();
    console.error(exception.stderr.toString());
    expect(issue).to.be.null;
  }
}

async function testReadData(format, port) {

  // If problem with source (e.g. not up), skip test.
  try { await got.get("http://localhost:"+port, {timeout:5000}); } catch(error) { if(error.message.includes("ECONNREFUSED")) return null; };

  const TIMESTAMP = Date.now();
  let source = await fs.readFile("templates/read-potential-cases-"+format+".js", "utf-8");
  source = source.split("\n").filter((line)=>!line.trim().startsWith("/")).join("");
  source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);
  source = source.replaceAll("\n", ";");

  console.log(await runJSCode(source));

  csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-potential-cases.csv", "utf-8"), {quote: "'"});
  csv[0].should.have.property('patient-id');
  csv[0].should.have.property('dob');
  csv[0].should.have.property('codes');
  csv[0].should.have.property('last-encounter');

  return TIMESTAMP;

}

async function writeGenericSampleData(sampleDataFile) {
  await fs.writeFile("/tmp/"+sampleDataFile, 'patient-id,dob,codes,keywords,last-encounter\n');
  await fs.appendFile("/tmp/"+sampleDataFile, '1,1979-01-01,"(X01,2004-10-17T00:00:00.000),(Y01,2004-10-17T00:00:00.000),(Y02,2005-04-17T00:00:00.000),(Z01,2005-10-17T00:00:00.000),(Z02,2006-10-17T00:00:00.000),(E01,3000-10-17T00:00:00.000)","keyword1,keyword2",2020-01-01\n');
  await fs.appendFile("/tmp/"+sampleDataFile, '2,2020-01-01,"(Y01,2004-10-17T00:00:00.000),(Y02,2005-10-17T00:00:00.000),(Z01,2004-10-17T00:00:00.000),(Z02,2005-10-17T00:00:00.000)","keyword1,keyword2",1920-01-01\n');
}

async function testCodelist(existingTimestamp=null, codelist="X01", exclude=false) {

  const TIMESTAMP = Date.now();
  let source = await fs.readFile(exclude?"templates/codelist-exclude.py":"templates/codelist.py", "utf-8");
  source = source.replaceAll("[AUTHOR]", "martinchapman");
  source = source.replaceAll("[YEAR]", "2021");
  source = source.replaceAll("[LIST]", "'"+codelist+"'");
  source = source.replaceAll("[REQUIRED_CODES]", "1");
  source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);
  source = source.replaceAll("[CATEGORY]", "category");

  let sampleDataFile;
  if(!existingTimestamp) {
    sampleDataFile = "sample-data-codes-"+TIMESTAMP;
    await writeGenericSampleData(sampleDataFile);
  } else {
    sampleDataFile = "phenotype-"+existingTimestamp+"-potential-cases.csv";
  }
  let results = await runPythonCode(source, "/tmp/"+sampleDataFile);
  if(results) console.log(results);

  csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-potential-cases.csv"));
  expect(csv[0][exclude?'category-exclusion':'category-identified']).to.equal(exclude?'TRUE':'CASE');
  expect(csv[1][exclude?'category-exclusion':'category-identified']).to.equal(exclude?'FALSE':'UNK');

}

async function testAgeCheck(existingTimestamp=null, ageExclusion=['FALSE', 'TRUE']) {

  const TIMESTAMP = Date.now();
  let source = await fs.readFile("templates/age.py", "utf-8");
  source = source.replaceAll("[AUTHOR]", "martinchapman");
  source = source.replaceAll("[YEAR]", "2021");
  source = source.replaceAll("[AGE_LOWER]", "30");
  source = source.replaceAll("[AGE_UPPER]", "80");
  source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);

  let sampleDataFile;
  if(!existingTimestamp) {
    sampleDataFile = "sample-data-age-"+TIMESTAMP;
    await writeGenericSampleData(sampleDataFile);
  } else {
    sampleDataFile = "phenotype-"+existingTimestamp+"-potential-cases.csv";
  }
  let results = await runPythonCode(source, "/tmp/"+sampleDataFile);
  if(results) console.log(results);

  csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-potential-cases.csv"));
  expect(csv[0]['age-exclusion']).to.equal(ageExclusion[0]);
  expect(csv[1]['age-exclusion']).to.equal(ageExclusion[1]);

}

async function testLastEncounterCheck(existingTimestamp=null, encounterExclusion=['FALSE', 'TRUE']) {

  const TIMESTAMP = Date.now();
  let source = await fs.readFile("templates/last-encounter.py", "utf-8");
  source = source.replaceAll("[AUTHOR]", "martinchapman");
  source = source.replaceAll("[YEAR]", "2021");
  source = source.replaceAll("[MAX_YEARS]", "10");
  source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);
  
  let sampleDataFile;
  if(!existingTimestamp) {
    sampleDataFile = "sample-data-last-encounter-"+TIMESTAMP;
    await writeGenericSampleData(sampleDataFile);
  } else {
    sampleDataFile = "phenotype-"+existingTimestamp+"-potential-cases.csv";
  }
  let results = await runPythonCode(source, "/tmp/"+sampleDataFile);
  if(results) console.log(results);

  csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-potential-cases.csv"));
  expect(csv[0]['last-encounter-exclusion']).to.equal(encounterExclusion[0]);
  expect(csv[1]['last-encounter-exclusion']).to.equal(encounterExclusion[1]);

}

async function runPythonCode(codelistSource, input) {
  return new Promise((resolve, reject) => {
    shell.runString(codelistSource, {args:input}, function (error, results) {
      if(error) reject(error);
      resolve(results);
    });
  });
}

describe("templates", () => {

  describe("execute templates", () => {

    it("[TE01] Should be able to read from disc.", async() => {
      const TIMESTAMP = Date.now();
      let source = await fs.readFile("templates/read-potential-cases-disc.py", "utf-8");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);
      
      const SAMPLE_DATA_FILE = "sample-data-codes-"+TIMESTAMP;
      await writeGenericSampleData(SAMPLE_DATA_FILE);
      let results = await runPythonCode(source, "/tmp/"+SAMPLE_DATA_FILE);
      if(results) console.log(results);
      csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-potential-cases.csv"));
      expect(csv.length).to.equal(2);
    });

    it("[TE02] Should be able to read from disc (js).", async() => {
      const TIMESTAMP = Date.now();
      let source = await fs.readFile("templates/read-potential-cases-disc.js", "utf-8");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);
      
      const SAMPLE_DATA_FILE = "sample-data-codes-"+TIMESTAMP;
      await writeGenericSampleData(SAMPLE_DATA_FILE);
      let results = await runJSCode(source, "/tmp/"+SAMPLE_DATA_FILE);
      if(results) console.log(results);
      csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-potential-cases.csv"));
      expect(csv.length).to.equal(2);
    });

    it("[TE03] Should be able to read from i2b2 server.", async() => {
      await testReadData("i2b2", 8081);
    }).timeout(0);

    it("[TE04] Should be able to read from OMOP server.", async() => {
      await testReadData("omop", 8081);
    }).timeout(0);

    it("[TE05] Should be able to read from FHIR server.", async() => {
      await testReadData("fhir", 8081);
    }).timeout(0);

		it("[TE06] Should be able to execute codelist.", async() => {
      await testCodelist();
    });

    it("[TE06] Should be able to execute a codelist exclude.", async() => {
      await testCodelist(null, "X01", true);
    });

    it("[TE08] Should be able to execute a keyword list.", async() => {
      let source = await fs.readFile("templates/keywords.py", "utf-8");
      source = source.replaceAll("[AUTHOR]", "martinchapman");
      source = source.replaceAll("[YEAR]", "2021");
      source = source.replaceAll("[LIST]", "'keyword1'");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
      source = source.replaceAll("[CATEGORY]", "category");
      let results = await runPythonCode(source, "test/fixtures/templates/sample-data.csv");
      if(results) console.log(results);
    });

    it("[TE09] Should be able to execute an age check.", async() => {
      await testAgeCheck();
    });

    it("[TE10] Should be able to execute a last encounter check.", async() => {
      await testLastEncounterCheck();
    });

    it("[TE11] Should be able to execute output cases.", async() => {
      const TIMESTAMP = Date.now();
      let source = await fs.readFile("templates/output-cases.py", "utf-8");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);

      const SAMPLE_DATA_FILE = "sample-data-output-"+TIMESTAMP;
      await fs.writeFile("/tmp/"+SAMPLE_DATA_FILE, 'patient-id,dob,codes,keywords,age-exclusion,codesA-identified,codesB-identified,last-encounter\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA_FILE, '1,1979-01-01,"X01,X02","keyword1,keyword2",TRUE,CASE,CASE,2020-01-01\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA_FILE, '2,1979-01-01,"Z01,Z02","keyword1,keyword2",FALSE,UNK,CASE,2020-01-01\n');
      let results = await runPythonCode(source, ["/tmp/"+SAMPLE_DATA_FILE]); 
      if(results) console.log(results);
      
      csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-cases.csv"));
      expect(csv[0]['codesA-identified']).to.equal('UNK');
      expect(csv[0]['codesB-identified']).to.equal('UNK');
      expect(csv[0]['last-encounter']).to.equal('2020-01-01');
      expect(csv[1]['codesA-identified']).to.equal('UNK');
      expect(csv[1]['codesB-identified']).to.equal('CASE');
      expect(csv[1]['last-encounter']).to.equal('2020-01-01');
    });

    it("[TE12] i2b2 output to codelist.", async() => {
      let timestamp = await testReadData("i2b2", 8081);
      if(timestamp) await testCodelist(timestamp, "466.11"); // Known code for first patient (and not second) in test i2b2 DB
    }).timeout(0);

    it("[TE13] i2b2 output to age check.", async() => {
      let timestamp = await testReadData("i2b2", 8081);
      if(timestamp) await testAgeCheck(timestamp, ['TRUE', 'TRUE']); // Known whether excluded by age for first two patients in test i2b2 DB
    }).timeout(0);

    it("[TE14] i2b2 output to encounter check.", async() => {
      let timestamp = await testReadData("i2b2", 8081);
      if(timestamp) await testLastEncounterCheck(timestamp, ['TRUE', 'TRUE']); // Known whether excluded by last encounter for first two patients in test i2b2 DB
    }).timeout(0);

    it("[TE15] OMOP output to codelist.", async() => {
      let timestamp = await testReadData("omop", 8081);
      if(timestamp) await testCodelist(timestamp, "80502");
    }).timeout(0);

    it("[TE16] OMOP output to age check.", async() => {
      let timestamp = await testReadData("omop", 8081);
      if(timestamp) await testAgeCheck(timestamp, ['TRUE', 'FALSE']);
    }).timeout(0);

    it("[TE17] OMOP output to encounter check.", async() => {
      let timestamp = await testReadData("omop", 8081);
      if(timestamp) await testLastEncounterCheck(timestamp, ['TRUE', 'TRUE']);
    }).timeout(0);

    it("[TE18] FHIR output to codelist.", async() => {
      let timestamp = await testReadData("fhir", 8081);
      if(timestamp) await testCodelist(timestamp, "19169002");
    }).timeout(0);

    it("[TE19] FHIR output to age check.", async() => {
      let timestamp = await testReadData("fhir", 8081);
      if(timestamp) await testAgeCheck(timestamp, ['TRUE', 'TRUE']);
    }).timeout(0);

    it("[TE20] FHIR output to encounter check.", async() => {
      let timestamp = await testReadData("fhir", 8081);
      if(timestamp) await testLastEncounterCheck(timestamp, ['FALSE', 'FALSE']);
    }).timeout(0);

    it("[TE21] Should be able to execute codelist temporal relationship.", async() => {
      
      const TIMESTAMP = Date.now();
      let source = await fs.readFile("templates/codelists-temporal.py", "utf-8");
      source = source.replaceAll("[AUTHOR]", "martinchapman");
      source = source.replaceAll("[YEAR]", "2021");
      source = source.replaceAll("[LIST_BEFORE]", "'Y01','Y02'");
      source = source.replaceAll("[LIST_AFTER]", "'Z01','Z02'");
      source = source.replaceAll("[MIN_DAYS]", "31");
      source = source.replaceAll("[MAX_DAYS]", "186");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);
      source = source.replaceAll("[CATEGORY]", "category");
    
      const sampleDataFile = "sample-data-codes-temporal-"+TIMESTAMP;
      await writeGenericSampleData(sampleDataFile);
      let results = await runPythonCode(source, "/tmp/"+sampleDataFile);
      if(results) console.log(results);
    
      csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-potential-cases.csv"));
      expect(csv[0]['category-identified']).to.equal('CASE');
      expect(csv[1]['category-identified']).to.equal('UNK');

    }).timeout(0);

    it("[TE22] Should be able to execute output cases conditional.", async() => {
      const TIMESTAMP = Date.now();
      let source = await fs.readFile("templates/output-codelist-multiple.py", "utf-8");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);
      source = source.replaceAll("[CASES]", "['codesA-categoryA-identified','codesA-categoryB-identified'],['codesC-categoryA-identified']");
      source = source.replaceAll("[NESTED]", "nested-phenotype-name");

      const SAMPLE_DATA_FILE = "sample-data-output-conditional-"+TIMESTAMP;
      await fs.writeFile("/tmp/"+SAMPLE_DATA_FILE, 'patient-id,dob,codes,keywords,codesA-categoryA-identified,codesA-categoryB-identified,codesB-categoryA-exclusion,codesC-categoryA-identified\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA_FILE, '1,1979-01-01,"X01,X02","keyword1,keyword2",UNK,CASE,FALSE,CASE\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA_FILE, '2,1979-01-01,"Y01,Y02","keyword1,keyword2",UNK,UNK,FALSE,CASE\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA_FILE, '3,1979-01-01,"Z01,Z02","keyword1,keyword2",CASE,CASE,TRUE,CASE\n');
      let results = await runPythonCode(source, ["/tmp/"+SAMPLE_DATA_FILE]); 
      if(results) console.log(results);
      
      csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-cases.csv"));
      console.log(csv);
      expect(csv[0]['nested-phenotype-name-identified']).to.equal('CASE');
      expect(csv[1]['nested-phenotype-name-identified']).to.equal('UNK');
      expect(csv[2]['nested-phenotype-name-identified']).to.equal('UNK');
    });

  });

});

