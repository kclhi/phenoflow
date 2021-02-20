const nlp = require('compromise')
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
const logger = require("../config/winston");
const config = require("config");
const stringSimilarity = require("string-similarity");
const natural = require("natural");
const stemmer = natural.PorterStemmer;
const Download = require("../util/download");
const Workflow = require("./workflow");
const workflowUtils = require("../util/workflow");
const { commitPushWorkflowRepo } = require('../util/visualise');

describe("importer", () => {

  describe("/POST import csv", () => {

    it("[TI1] Should be able to add a new user (CSVs).", async() => {
      const result = await models.user.create({name:"caliber", password: config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://portal.caliberresearch.org"});
      result.should.be.a("object");
    });

    function categorise(code, description, codeCategories, name, primary=true) {
      let placed=false;
      let primarySecondary = primary?" - primary":" - secondary";
      function orderKey(key) {
        // Don't attempt reorder on more than two words
        let keyTerms = key.split(" ");
        if(keyTerms.length!=2) return key;
        let nlpKey = nlp(key);
        let adjectives = nlpKey.adjectives()?nlpKey.adjectives().out("text").split(" "):null;
        let nouns = nlpKey.nouns()?nlpKey.nouns().out("text").split(" "):null;
        // Adjectives first; both nouns, condition first
        if(adjectives&&adjectives.length==1&&adjectives[0]!=keyTerms[0]
          ||nouns&&nouns.length==2&&name!=keyTerms[0]) {
            key=keyTerms[1].toLowerCase();
            key+=" "+keyTerms[0].toLowerCase();
          }
          key=key.charAt(0).toUpperCase() + key.slice(1).toLowerCase();
          return key;
        }
        function clean(input) {
          return input.toLowerCase().replace(/[^a-zA-Z]/g, "");
        }
        for(let existingCategory of Object.keys(codeCategories)) {
          // Don't mix primary and secondary category groups
          if(primary&&!existingCategory.includes("primary")) continue;
          let existingCategoryPrefix = existingCategory.toLowerCase();
          existingCategoryPrefix = existingCategoryPrefix.replace(name.toLowerCase(), "").replace(primarySecondary, "").trim().toLowerCase();
          for(let term of description.split(" ")) {
            term = nlp(term).nouns().toSingular().text() || term;
            // Don't consider terms that are the condition itself
            if(stemmer.stem(term)==stemmer.stem(name)) continue;
            if((existingCategoryPrefix.includes(term.toLowerCase())
            || term.toLowerCase().includes(existingCategoryPrefix)
            || stringSimilarity.compareTwoStrings(term.toLowerCase(), existingCategoryPrefix) >= 0.8
          ) && term.length > 4) {
            codeCategories[existingCategory].push(code);
            if(term.toLowerCase()!=existingCategoryPrefix.toLowerCase()) {
              let suffix = (!clean(term).includes(clean(name))&&!clean(name).includes(clean(term)))?" "+name:"";
              codeCategories[orderKey(term + suffix) + primarySecondary] = codeCategories[existingCategory];
              delete codeCategories[existingCategory];
            }
            placed=true;
            break;
          }
        }
        if(placed) break;
      }
      // Don't add condition suffix if key already contains form of condition
      let suffix = (!clean(description).includes(clean(name))&&!clean(name).includes(clean(description))&&!description.split(" ").map(term=>{return stemmer.stem(term)}).includes(stemmer.stem(name)))?" "+name:"";
      if(!placed) codeCategories[orderKey(description + suffix) + primarySecondary] = [code];
      return codeCategories;
    }

    async function importPhenotypeCSVs(phenotypeFiles) {
      let fullCSV;

      for(let phenotypeFile of phenotypeFiles) {

        const PATH = "test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/"+phenotypeFile;

        try {
          await fs.stat(PATH)
        } catch(error) {
          console.error(PATH+" does not exist.");
          return false;
        }

        try {
          var markdown = JSON.parse(m2js.parse([PATH], {width: 0, content: true}));
          var markdownContent = markdown[phenotypeFile.replace(".md", "")];
        } catch(error) {
          console.error(phenotypeFile+": "+error);
          return false;
        }

        if(!markdownContent.codelists) return true;

        if(!Array.isArray(markdownContent.codelists)) markdownContent.codelists = [markdownContent.codelists];

        for(let codelist of markdownContent.codelists) {
          let currentCSVSource;
          codelist = codelist.endsWith(".csv")?codelist:codelist+".csv"
          codelist = codelist.replace(".csv.csv", ".csv")
          try {
            currentCSVSource = await fs.readFile("test/"+config.get("importer.CSV_FOLDER")+"/_data/codelists/"+codelist);
          } catch(error) {
            console.error("Could not read codelist for " + phenotypeFile + ": " + error);
            return false;
          }
          let currentCSV;
          try {
            currentCSV = await parse(currentCSVSource);
          } catch(error) {
            console.error(error)
          }
          fullCSV = fullCSV?fullCSV.concat(currentCSV):currentCSV;
        }

      }

      if(!fullCSV) return false;
      let codeCategories = {};
      let hasCategory = ["readcode", "snomedconceptid", "icdcode", "icd10code", "icd11code", "opcs4code"];
      let toCategorise = ["readv2code", "snomedctconceptid"];
      let codingSystems = ["Read", "ICD-9", "ICD-10"];
      for(let row of fullCSV) {
        // Remove special characters from keys that prevent indexing
        for(const [key, value] of Object.entries(row)) {
          if(key!=key.replace(/[^a-zA-Z0-9]/g, "")) {
            row[key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()] = row[key];
            delete row[key];
            continue;
          }
          if(key.toLowerCase()!=key) {
            row[key.toLowerCase()] = row[key];
            delete row[key];
          }
        }
        let keys = Object.keys(row);
        let value, hasCategoryKeys, toCategoriseKeys;
        function getFirstUsableValue(keys, row) {
          let value;
          for(let key of keys) {
            if (!row[key]||!row[key].length) continue;
            value = row[key];
            break;
          }
          if(!value) console.error("No usable value for "+JSON.stringify(row)+" of "+phenotypeFile);
          return value;
        }
        if((hasCategoryKeys = keys.filter(value=>hasCategory.includes(value))) && hasCategoryKeys.length) {
          let category = (row["category"]||row["calibercategory"]||markdownContent.name) + ((hasCategoryKeys[0].includes("read")||hasCategoryKeys[0].includes("snomed"))?" - primary":" - secondary");
          if(!codeCategories[category]) codeCategories[category] = [];
          value = getFirstUsableValue(hasCategoryKeys, row);
          if(value) { codeCategories[category].push(value) } else { return false };
        } else if(row["codingsystem"] && codingSystems.includes(row["codingsystem"])) {
          let description = row["description"].replace("[X]", "").replace("[D]", "");
          if(!row["code"]) return false;
          codeCategories = categorise(row["code"], description, codeCategories, markdownContent.name);
        } else if((toCategoriseKeys = keys.filter(value => toCategorise.includes(value))) && toCategoriseKeys.length) {
          let description = row["description"].replace("[X]", "").replace("[D]", "");
          value = getFirstUsableValue(toCategoriseKeys, row);
          if(value) {codeCategories = categorise(value, description, codeCategories, markdownContent.name); } else { return false };
        } else if(row["prodcode"]) {
          let category = "Use of " + row["drugsubstance"];
          if(!codeCategories[category]) codeCategories[category] = [];
          if(!row["prodcode"]) return false;
          codeCategories[category].push(row["prodcode"]);
        } else if(row["code"]) {
          let category = markdownContent.name + " - UK Biobank";
          if (!codeCategories[category]) codeCategories[category] = [];
          if(!row["code"]) return false;
          codeCategories[category].push(row["code"]);
        } else {
          console.error("No handler for: " + JSON.stringify(row));
          continue;
        }
      }

      if(Object.keys(codeCategories).indexOf("undefined - primary")>-1 || Object.keys(codeCategories).indexOf("undefined - secondary")>-1) {
        console.error("No category for " + markdownContent.name + ": " + JSON.stringify(codeCategories));
        return false;
      }

      const server = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
      let res = await chai.request(server).post("/phenoflow/importer").send({name:markdownContent.name, about:markdownContent.phenotype_id+" - "+markdownContent.title, codeCategories:codeCategories, userName:"caliber"});
      res.should.have.status(200);
      res.body.should.be.a("object");
      return true;
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

    it("[TI2] Should be able to import a phenotype CSV.", async() => {
      const phenotypeFile = "axson_COPD_Y9JxuQRFPprJDMHSPowJYs.md";
      const PATH = "test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/";
      // Can't perform test if file doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      if(config.get("importer.GROUP_SIMILAR_PHENOTYPES")) {
        for(let phenotypeFiles of await groupPhenotypeFiles(PATH)) {
          if(phenotypeFiles.includes(phenotypeFile)) expect(await importPhenotypeCSVs(phenotypeFiles)).to.be.true;
        }
      } else {
        expect(await importPhenotypeCSVs([phenotypeFile]));
      }
    }).timeout(0);

    it("[TI3] Should be able to import all phenotype CSVs.", async() => {
      const PATH = "test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/";
      // Can't perform test if folder doesn't exist.
      try { await fs.stat(PATH) } catch(error) { return true; }
      for(let phenotypeFiles of await groupPhenotypeFiles(PATH)) {
        if(config.get("importer.GROUP_SIMILAR_PHENOTYPES")) {
          expect(await importPhenotypeCSVs(phenotypeFiles)).to.be.true;
        } else {
          for(let phenotypeFile of phenotypeFiles) {
            expect(await importPhenotypeCSVs([phenotypeFile])).to.be.true;
          }
        }
      }
    }).timeout(0);

    it("[TI4] Should be able to annotate CALIBER MD files with a phenoflow URL.", async() => {
      const PATH = "test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/";
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

    it("[TI5] Create children for imported phenotypes.", async() => {
      for(let workflow of await models.workflow.findAll({where:{complete:true}, order:[['createdAt', 'DESC']]})) await workflowUtils.workflowChild(workflow.id);
    }).timeout(0);

  });

});
