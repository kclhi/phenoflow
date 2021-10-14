
const chai = require("chai");
chai.use(require("chai-http"));
const expect = chai.expect;
const got = require("got");
const fs = require("fs").promises;
const { PythonShell: shell } = require("python-shell");
const spawn = require("await-spawn");

async function testReadData(source, port) {

  // If problem with source (e.g. not up), skip test.
  try { await got.get("http://localhost:"+port, {timeout:5000}); } catch(error) { return true; };

  let codelistSource = await fs.readFile("templates/read-potential-cases-"+source+".js", "utf-8");
  codelistSource = codelistSource.split("\n").filter((line)=>!line.trim().startsWith("/")).join("");
  codelistSource = codelistSource.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
  codelistSource = codelistSource.replaceAll("\n", ";");

  try {
    const shell = await spawn('node', ['-e', codelistSource])
  } catch (exception) {
    let issue = exception.stderr.toString();
    console.error(exception.stderr.toString());
    expect(issue).to.be.null;
  }

}

describe("templates", () => {

  describe("execute templates", () => {

    it("[T1] Should be able to read from disc.", async() => {
      let codelistSource = await fs.readFile("templates/read-potential-cases-disc.py", "utf-8");
      codelistSource = codelistSource.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");

      await new Promise((resolve, reject) => {
        shell.runString(codelistSource, {args: ["test/fixtures/templates/sample-data.csv"]}, function (error, results) {
          if(error) reject(error);
          resolve(results);
        });
      })
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
      let codelistSource = await fs.readFile("templates/codelist.py", "utf-8");
      codelistSource = codelistSource.replaceAll("[AUTHOR]", "martinchapman");
      codelistSource = codelistSource.replaceAll("[YEAR]", "2021");
      codelistSource = codelistSource.replaceAll("[LIST]", "'code1'");
      codelistSource = codelistSource.replaceAll("[REQUIRED_CODES]", "1");
      codelistSource = codelistSource.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
      codelistSource = codelistSource.replaceAll("[CATEGORY]", "category");

      await new Promise((resolve, reject) => {
        shell.runString(codelistSource, {args: ["test/fixtures/templates/sample-data.csv"]}, function (error, results) {
          if(error) reject(error);
          resolve(results);
        });
      })
    });

    it("[T6] Should be able to execute a keyword list.", async() => {
      let codelistSource = await fs.readFile("templates/keywords.py", "utf-8");
      codelistSource = codelistSource.replaceAll("[AUTHOR]", "martinchapman");
      codelistSource = codelistSource.replaceAll("[YEAR]", "2021");
      codelistSource = codelistSource.replaceAll("[LIST]", "'keyword1'");
      codelistSource = codelistSource.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");
      codelistSource = codelistSource.replaceAll("[CATEGORY]", "category");

      await new Promise((resolve, reject) => {
        shell.runString(codelistSource, {args: ["test/fixtures/templates/sample-data.csv"]}, function (error, results) {
          if(error) reject(error);
          resolve(results);
        });
      })
    });

    it("[T7] Should be able to execute an age check.", async() => {
      let codelistSource = await fs.readFile("templates/age.py", "utf-8");
      codelistSource = codelistSource.replaceAll("[AUTHOR]", "martinchapman");
      codelistSource = codelistSource.replaceAll("[YEAR]", "2021");
      codelistSource = codelistSource.replaceAll("[AGE_LOWER]", "30");
      codelistSource = codelistSource.replaceAll("[AGE_UPPER]", "60");
      codelistSource = codelistSource.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");

      await new Promise((resolve, reject) => {
        shell.runString(codelistSource, {args: ["test/fixtures/templates/sample-data.csv"]}, function (error, results) {
          if(error) reject(error);
          resolve(results);
        });
      })
    });

    it("[T8] Should be able to execute a last encounter check.", async() => {
      let codelistSource = await fs.readFile("templates/last-encounter.py", "utf-8");
      codelistSource = codelistSource.replaceAll("[AUTHOR]", "martinchapman");
      codelistSource = codelistSource.replaceAll("[YEAR]", "2021");
      codelistSource = codelistSource.replaceAll("[MAX_YEARS]", "10");
      codelistSource = codelistSource.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");

      await new Promise((resolve, reject) => {
        shell.runString(codelistSource, {args: ["test/fixtures/templates/sample-data.csv"]}, function (error, results) {
          if(error) reject(error);
          resolve(results);
        });
      })
    });

    it("[T8] Should be able to execute output cases.", async() => {
      let codelistSource = await fs.readFile("templates/output-cases.py", "utf-8");
      codelistSource = codelistSource.replaceAll("[PHENOTYPE]", "/tmp/phenotype-");

      await new Promise((resolve, reject) => {
        shell.runString(codelistSource, {args: ["test/fixtures/templates/sample-data.csv"]}, function (error, results) {
          if(error) reject(error);
          resolve(results);
        });
      })
    });

   

  });

});

