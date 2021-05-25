const Importer = require("./importer");
const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fsfull = require("fs");
const fs = require("fs").promises;
const proxyquire = require('proxyquire');
const m2js = require("markdown-to-json");
const parse = require('neat-csv');
const models = require("../models");
const config = require("config");
const workflowUtils = require("../util/workflow");

describe("caliber importer", () => {

  describe("/POST import caliber csv", () => {

    it("[CI1] Should be able to add a new user (CSVs).", async() => {
      const result = await models.user.create({name:"caliber", password: config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://portal.caliberresearch.org"});
      result.should.be.a("object");
    });

    it("[CI2] Should be able to import a phenotype CSV.", async() => {
      const phenotypeFile = "axson_COPD_Y9JxuQRFPprJDMHSPowJYs.md";
      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      if(config.get("importer.GROUP_SIMILAR_PHENOTYPES")) {
        for(let phenotypeFiles of await importer.groupPhenotypeFiles(PATH)) {
          if(phenotypeFiles.includes(phenotypeFile)) expect(await importPhenotypeCSVs(phenotypeFiles), importPhenotype).to.be.true;
        }
      } else {
        expect(await Importer.importPhenotypeCSVs([phenotypeFile]), importPhenotype);
      }
    }).timeout(0);

    it("[CI3] Should be able to import all phenotype CSVs.", async() => {
      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
      // Can't perform test if folder doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      for(let phenotypeFiles of await Importer.groupPhenotypeFiles(PATH)) {
        if(config.get("importer.GROUP_SIMILAR_PHENOTYPES")) {
          expect(await Importer.importPhenotypeCSVs(phenotypeFiles)).to.be.true;
        } else {
          for(let phenotypeFile of phenotypeFiles) {
            expect(await Importer.importPhenotypeCSVs([phenotypeFile])).to.be.true;
          }
        }
      }
    }).timeout(0);

    it("[CI4] Should be able to import multiple phenotype CSVs with the same name.", async() => {
      const phenotypeFiles = ["Carr_Anxiety_5bqxGMaqvZFBhtEYb5mhZJ.md", "kuan_anxiety_LGWMqosnAtERehdytPzBWy.md"];
      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      for(let phenotypeFile of phenotypeFiles) {
        expect(await Importer.importPhenotypeCSVs([phenotypeFile])).to.be.true;
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
        await fs.writeFile("test/output/importer/" + file, yaml);
      }
    }).timeout(0);

    it("[CI6] Create children for imported phenotypes.", async() => {
      for(let workflow of await models.workflow.findAll({where:{complete:true}, order:[['createdAt', 'DESC']]})) await workflowUtils.workflowChild(workflow.id);
    }).timeout(0);

  });

});
