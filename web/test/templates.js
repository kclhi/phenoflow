
const chai = require("chai");
chai.use(require("chai-http"));
const expect = chai.expect;
const got = require("got");
const fs = require("fs").promises;
const { PythonShell: shell } = require("python-shell");
const spawn = require("await-spawn");
const parse = require('neat-csv');

async function testReadData(format, port) {

  // If problem with source (e.g. not up), skip test.
  try { await got.get("http://localhost:"+port, {timeout:5000}); } catch(error) { return true; };

  let source = await fs.readFile("templates/read-potential-cases-"+format+".js", "utf-8");
  source = source.split("\n").filter((line)=>!line.trim().startsWith("/")).join("");
  source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
  source = source.replaceAll("\n", ";");

  try {
    const shell = await spawn('node', ['-e', source])
  } catch (exception) {
    let issue = exception.stderr.toString();
    console.error(exception.stderr.toString());
    expect(issue).to.be.null;
  }

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

    it("[T1] Should be able to read from disc.", async() => {
      let source = await fs.readFile("templates/read-potential-cases-disc.py", "utf-8");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
      let results = await runPythonCode(source, "test/fixtures/templates/sample-data.csv");
      if(results) console.log(results);
    });

    it("[T2] Should be able to read from i2b2 server.", async() => {
      await testReadData("i2b2", 8081);
    }).timeout(0);

    it("[T3] Should be able to read from OMOP server.", async() => {
      await testReadData("omop", 8080);
    }).timeout(0);

    it("[T4] Should be able to read from FHIR server.", async() => {
      await testReadData("fhir", 8081);
    }).timeout(0);

		it("[T5] Should be able to execute codelist.", async() => {
      const TIMESTAMP = Date.now();
      let source = await fs.readFile("templates/codelist.py", "utf-8");
      source = source.replaceAll("[AUTHOR]", "martinchapman");
      source = source.replaceAll("[YEAR]", "2021");
      source = source.replaceAll("[LIST]", "'X01'");
      source = source.replaceAll("[REQUIRED_CODES]", "1");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);
      source = source.replaceAll("[CATEGORY]", "category");

      const SAMPLE_DATA = "sample-data-T5-"+TIMESTAMP;
      await fs.writeFile("/tmp/"+SAMPLE_DATA, 'patient-id,dob,codes,keywords,last-encounter\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA, '1,1979-01-01,"X01,X02","keyword1,keyword2",2020-01-01\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA, '2,1979-01-01,"Z01,Z02","keyword1,keyword2",2020-01-01\n');
      let results = await runPythonCode(source, "/tmp/"+SAMPLE_DATA);
      if(results) console.log(results);

      csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-potential-cases.csv"));
      expect(csv[0]['category-identified']).to.equal('CASE');
      expect(csv[1]['category-identified']).to.equal('UNK');
    });

    it("[T6] Should be able to execute a keyword list.", async() => {
      let source = await fs.readFile("templates/keywords.py", "utf-8");
      source = source.replaceAll("[AUTHOR]", "martinchapman");
      source = source.replaceAll("[YEAR]", "2021");
      source = source.replaceAll("[LIST]", "'keyword1'");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
      source = source.replaceAll("[CATEGORY]", "category");
      let results = await runPythonCode(source, "test/fixtures/templates/sample-data.csv");
      if(results) console.log(results);
    });

    it("[T7] Should be able to execute an age check.", async() => {
      let source = await fs.readFile("templates/age.py", "utf-8");
      source = source.replaceAll("[AUTHOR]", "martinchapman");
      source = source.replaceAll("[YEAR]", "2021");
      source = source.replaceAll("[AGE_LOWER]", "30");
      source = source.replaceAll("[AGE_UPPER]", "60");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
      let results = await runPythonCode(source, "test/fixtures/templates/sample-data.csv");
      if(results) console.log(results);
    });

    it("[T8] Should be able to execute a last encounter check.", async() => {
      let source = await fs.readFile("templates/last-encounter.py", "utf-8");
      source = source.replaceAll("[AUTHOR]", "martinchapman");
      source = source.replaceAll("[YEAR]", "2021");
      source = source.replaceAll("[MAX_YEARS]", "10");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
      let results = await runPythonCode(source, "test/fixtures/templates/sample-data.csv");
      if(results) console.log(results);
    });

    it("[T9] Should be able to execute output cases.", async() => {
      const TIMESTAMP = Date.now();
      let source = await fs.readFile("templates/output-cases.py", "utf-8");
      source = source.replaceAll("[PHENOTYPE]", "/tmp/phenotype-"+TIMESTAMP);

      const SAMPLE_DATA = "sample-data-T5-"+TIMESTAMP;
      await fs.writeFile("/tmp/"+SAMPLE_DATA, 'patient-id,dob,codes,keywords,age-exclusion,codesA-identified,codesB-identified,last-encounter\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA, '1,1979-01-01,"X01,X02","keyword1,keyword2",TRUE,CASE,CASE,2020-01-01\n');
      await fs.appendFile("/tmp/"+SAMPLE_DATA, '2,1979-01-01,"Z01,Z02","keyword1,keyword2",FALSE,UNK,CASE,2020-01-01\n');
      let results = await runPythonCode(source, ["/tmp/"+SAMPLE_DATA]); 
      if(results) console.log(results);
      
      csv = await parse(await fs.readFile("/tmp/phenotype-"+TIMESTAMP+"-cases.csv"));
      expect(csv[0]['codesA-identified']).to.equal('UNK');
      expect(csv[0]['codesB-identified']).to.equal('UNK');
      expect(csv[0]['last-encounter']).to.equal('2020-01-01');
      expect(csv[1]['codesA-identified']).to.equal('UNK');
      expect(csv[1]['codesB-identified']).to.equal('CASE');
      expect(csv[1]['last-encounter']).to.equal('2020-01-01');
    });

  });

});

