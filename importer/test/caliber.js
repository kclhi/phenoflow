const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const expect = chai.expect;
const fs = require("fs").promises;
const m2js = require("markdown-to-json");
const parse = require('neat-csv');
const models = require("../models");
const config = require("config");
const proxyquire = require('proxyquire');
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt': { expressjwt(...args) {return (req, res, next)=>{return next();}}}})});

async function importCaliberPhenotypes(phenotypeFiles) {
  let allCSVs=[];

  for(let phenotypeFile of phenotypeFiles) {

    const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/"+phenotypeFile;

    try {
      await fs.stat(PATH)
    } catch(error) {
      console.warn(PATH+" does not exist.");
      continue;
    }

    try {
      var markdown = JSON.parse(m2js.parse([PATH], {width: 0, content: true}));
      var markdownContent = markdown[phenotypeFile.replace(".md", "")];
    } catch(error) {
      console.warn(phenotypeFile+": "+error);
      continue;
    }

    if(!markdownContent.codelists) continue;

    if(!Array.isArray(markdownContent.codelists)) markdownContent.codelists = [markdownContent.codelists];

    for(let codelist of markdownContent.codelists) {
      let currentCSVSource;
      codelist = codelist.endsWith(".csv")?codelist:codelist+".csv"
      codelist = codelist.replace(".csv.csv", ".csv")
      try {
        currentCSVSource = await fs.readFile("test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_data/codelists/"+codelist);
      } catch(error) {
        console.warn("Could not read codelist for " + phenotypeFile + ": " + error);
        continue;
      }
      let currentCSV;
      try {
        currentCSV = await parse(currentCSVSource);
      } catch(error) {
        console.error(error);
        return false;
      }
      allCSVs.push({"filename":codelist, "content":currentCSV});
    }

  }
  if(allCSVs.length==0) return;
  let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:allCSVs, name:markdownContent.name, about:markdownContent.phenotype_id+" - "+markdownContent.title, userName:"caliber"});
  res.should.be.a("object");
  res.should.have.status(200);
  
}

async function groupPhenotypeFiles(path) {
  let phenotypeFiles = await fs.readdir(path);
  let groups={};
  for(let phenotypeFile of phenotypeFiles) {
    let markdown = JSON.parse(m2js.parse([path+phenotypeFile], {width: 0, content: true}))[phenotypeFile.replace(".md", "")];
    (groups[markdown.name+markdown.title]=groups[markdown.name+markdown.title]?groups[markdown.name+markdown.title]:[]).push(phenotypeFile);
  }
  return Object.values(groups);
}

async function testCaliberPhenotype(phenotypeFile) {
  const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
  // Can't perform test if file doesn't exist.
  try { await fs.stat(PATH) } catch(error) { return true; }
  if(config.get("importer.GROUP_SIMILAR_PHENOTYPES")) {
    for(let phenotypeFiles of await groupPhenotypeFiles(PATH)) {
      if(phenotypeFiles.includes(phenotypeFile)) {
        await importCaliberPhenotypes(phenotypeFiles);
      }
    }
  } else {
    await importCaliberPhenotypes([phenotypeFile]);
  }
}

describe("caliber importer", () => {

  describe("/POST import caliber csv", () => {

    it("[CI1] Should be able to add a new user (CSVs).", async() => {
      const result = await models.user.create({name:"caliber", password: config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://portal.caliberresearch.org"});
      result.should.be.a("object");
    });
    
    it("[CI2] Should be able to import a phenotype CSV.", async() => {
      await testCaliberPhenotype("kuan_AAA_NJ2gf6ZTTxjayMcK5ksHXf.md");
    }).timeout(0);

    it("[CI3] Should be able to import all phenotype CSVs.", async() => {
      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
      // Can't perform test if folder doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      for(let phenotypeFiles of await groupPhenotypeFiles(PATH)) {
        console.log(phenotypeFiles);
        if(config.get("importer.GROUP_SIMILAR_PHENOTYPES")) {
          await importCaliberPhenotypes(phenotypeFiles);
        } else {
          for(let phenotypeFile of phenotypeFiles) {
            await importCaliberPhenotypes([phenotypeFile]);
          }
        }
      }
    }).timeout(0);

    it("[CI4] Should be able to import multiple phenotype CSVs with the same name.", async() => {
      const phenotypeFiles = ["kuan_diabetes_bYMFsBEu7tVB6YkrQ8aBvk.md", "sapey_diabetes_ZmgyhwLqB2QmAtxENwkL8X.md", "carr_diabetes_jQLxtg2Z3zPcXWge5Nv9tU.md"];
      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      for(let phenotypeFile of phenotypeFiles) {
        await importCaliberPhenotypes([phenotypeFile]);
      }
    }).timeout(0);

    it("[CI5] Should be able to annotate CALIBER MD files with a phenoflow URL.", async() => {
      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
      try { await fs.stat(PATH) } catch(error) { return true; }
      let ids=[];
      for(let file of await fs.readdir(PATH)) {
        const markdown = JSON.parse(m2js.parse([PATH+file], {width: 0, content: true}))[file.replace(".md", "")];
        if(!markdown.codelists) continue;
        let yaml;
        for(let term of markdown.name.split(" ")) {
          var res = await chai.request(server).post("/phenoflow/importer/caliber/annotate").send({markdown:markdown, name:term, about:markdown.phenotype_id});
          if(!res.body&&!res.body.markdowns) continue;
          for(let markdownYAML of res.body.markdowns) {
            var id = markdownYAML.match(/\/download\/[0-9]+"/g)[0];
            if(ids.includes(id)) continue;
            yaml = markdownYAML;
          }
        }
        if(!yaml) {
          console.error("No suitable phenotype found: " + markdown.name + " " + markdown.phenotype_id);
        }
        expect(yaml).to.not.be.undefined;
        if(!yaml.includes("phenoflow")) {
          console.error("Phenoflow link not added: " + yaml);
        }
        expect(yaml).to.include("phenoflow");
        ids.push(id);
        await fs.writeFile("test/fixtures/caliber/output/" + file, yaml);
      }
    }).timeout(0);

    it("[CI6] Importing the same (CALIBER) phenotype should result in no changes.", async() => {
      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
      try { await fs.stat(PATH) } catch(error) { return true; }
      await testCaliberPhenotype("blood-pressure.md");
      await testCaliberPhenotype("blood-pressure.md");
      let workflows = await models.workflow.findAndCountAll();
      expect(workflows.count).to.equal(4);
    }).timeout(0);

    it("[CI7] Importing an update to the same (CALIBER) phenotype should edit the existing definition.", async() => {
      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
      try { await fs.stat(PATH) } catch(error) { return true; }
      await testCaliberPhenotype("blood-pressure.md");
      await testCaliberPhenotype("blood-pressure-alt.md");
      let workflows = await models.workflow.findAndCountAll();
      expect(workflows.count).to.equal(4);
    }).timeout(0);

    it("[CI8] Import CALIBER validation set.", async() => {
      await testCaliberPhenotype("kuan_AAA_NJ2gf6ZTTxjayMcK5ksHXf.md");
      await testCaliberPhenotype("kuan_diabetes_bYMFsBEu7tVB6YkrQ8aBvk.md");
      await testCaliberPhenotype("sapey_diabetes_ZmgyhwLqB2QmAtxENwkL8X.md");
      await testCaliberPhenotype("carr_diabetes_jQLxtg2Z3zPcXWge5Nv9tU.md");
      await testCaliberPhenotype("kuan_RhA_EWvRLa7DNMCiGs2XvC2zKT.md");
    }).timeout(0);
    
  });

});
