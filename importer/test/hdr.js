const chai = require("chai");
chai.use(require("chai-http"));
const should = chai.should();
const expect = chai.expect;
const got = require("got");
const proxyquire = require('proxyquire');
const models = require("../models");
const logger = require("../config/winston");
const config = require("config");
const fs = require('fs').promises;
const nock = require('nock')
const testServerObject = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt': { expressjwt(...args) {return (req, res, next)=>{return next();}}}})});

describe("hdr", () => {

  describe("/POST import hdr", () => {

    async function addUser(name, homepage=config.get("phenoflow.HOMEPAGE")) {
      try {
        const result = await models.user.findOrCreate({
          where: {name:name},
          defaults: {name:name, password:config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:homepage}
        });
        result.should.be.a("Array");
      } catch(addUserError) {
        logger.error("Error adding user: " + addUserError + " (" + name + ")");
        return false;
      }
      return true;
    }

    async function getAllPhenotypesHDR() {
      let path;
      try {
        path = config.get("importer.HDR_API") + "/phenotypes/?format=json";
        // ~MDC 05/24 HDR UK library not able to reliably serve requests for all phenotypes, so use local mock for now
        nock(config.get("importer.HDR_API")).get("/phenotypes/?format=json").reply(200, JSON.parse(await fs.readFile("test/fixtures/importer/hdr/phenotypes.json", "utf8")));
        let phenotypes = await got.get(path, {responseType:"json"});
        nock.restore()
        return phenotypes.body;
      } catch(getAllPhenotypesError) {
        logger.error("Error getting all phenotypes: " + getAllPhenotypesError + " " + path);
        return [];
      }
    }

    async function getPhenotypeHDR(id) {
      try {
        let phenotype = await got.get(config.get("importer.HDR_API") + "/phenotypes/" + id + "/detail/?format=json", {responseType:"json"});
        return phenotype.body[0];
      } catch(getPhenotypeError) {
        logger.error("Error getting phenotype: " + getPhenotypeError);
        return [];
      }
    }

    async function importAllPhenotypesHDR(start=0) {
      let allPhenotypesHDR = (await getAllPhenotypesHDR()).slice(start);
      for(let phenotype of allPhenotypesHDR) {
        try {
          await importPhenotypeHDR(phenotype);
        } catch(importPhenotypeError) {
          logger.error("Error importing phenotype: " + importPhenotypeError);
          return false;
        }
      }
      return true;
    }

    function cleanName(name) {
      if(!name) {
        logger.warn('No name to clean')
        return name;
      }
      return name.replace(/(\s)?\(.*\)/g, "");
    }

    function checkAndReformatHDRPhenotypeName(name) {
      const MAX_PHENOTYPE_NAME_LENGTH = 60 // accounting for UUID
      if(cleanName(name).length>MAX_PHENOTYPE_NAME_LENGTH) {
        const words = name.split(" ");
        let editedName = words.reduce((accumulator, word) => {
          if((accumulator.length + (accumulator ? 1 : 0) + word.length) > MAX_PHENOTYPE_NAME_LENGTH) {
            return accumulator; 
          }
          return accumulator + (accumulator ? " " : "") + word;
        }, "");
        const editedNameWords = editedName.split(" ");
        // ending in a short word is rarely neat in an edited name, so remove
        if(editedNameWords[editedNameWords.length - 1].length <= 3) editedName = editedNameWords.slice(0, editedNameWords.length - 1).join(" ");
        // 'and X' is rarely neat in an edited name, so remove
        if(editedNameWords[editedNameWords.length - 2] == "and") editedName = editedNameWords.slice(0, editedNameWords.length - 2).join(" ");
        return editedName;
      }
      return name;
    }

    function checkAndReformatHDRAuthor(author) {
      if(author.length>255) {
        if(author.includes(",")) return author.split(",")[0] + "," + author.split(",")[1] + ", et. al";
        if(author.includes("and")) return author.split(" and ")[0] + ", " + author.split(" and ")[1] + ", et. al";
        return "";
      }
      return author;
    }

    function cleanPhenotypeHDR(phenotype) {
      phenotype.name = phenotype.name.replaceAll(" - ", " ");
      phenotype.author = phenotype.author.replaceAll(" & ", " and ");
      return phenotype;
    }

    async function importPhenotypeHDR(phenotype) {
      let allCSVs, path;
      if(!(phenotype.author=checkAndReformatHDRAuthor(phenotype.author))) return false;
      phenotype = cleanPhenotypeHDR(phenotype);
      try {
        path = config.get("importer.HDR_API") + "/phenotypes/" + phenotype.phenotype_id + "/export/codes/?format=json";
        allCSVs = await got.get(path, {responseType:"json"});
      } catch(getCodelistsError) {
        logger.error("Error getting codelist from phenotype: " + getCodelistsError + " " + path);
        return false;
      }
      try {
        allCSVs = allCSVs.body.filter(codelistEntry=>codelistEntry.code).reduce((accumulator, current) => { accumulator[current.coding_system] = (accumulator[current.coding_system]??[]).concat([{[current.coding_system.name.replace("codes", "code")]:current.code, "description":current.description?current.description.replace(/(?<!^)\(.*\)/,""):phenotype.name}]); return accumulator; }, {});
      } catch(formatCodelistError) {
        logger.error("Error formatting codelist: " + formatCodelistError + " " + path);
        return false;
      }
      allCSVs = Object.entries(allCSVs).map(codelist=>({"filename":phenotype.name.replaceAll(" ", "_") + "_" + phenotype.phenotype_id + "_" + codelist[0].replaceAll(" ", "_"), "content":codelist[1]}));
      if(!await addUser(phenotype.author)) return false;
      if(!allCSVs.length) return true;
      let res = await chai.request(testServerObject).post("/phenoflow/importer/importCodelists").send({csvs:allCSVs, name:checkAndReformatHDRPhenotypeName(phenotype.name), about:phenotype.name + " - " + phenotype.phenotype_id, userName:phenotype.author});
      res.should.be.a("object");
      res.should.have.status(200);
      return true;
    }

    it("[HDR1] Should be able to import a phenotype from the HDR UK phenotype library API", async () => {
      expect(await importPhenotypeHDR(await getPhenotypeHDR("PH10"))).to.be.true;
    }).timeout(0);

    it("[HDR2] Should be able to import a subset of phenotypes from the HDR UK phenotype library API", async () => {
      let allPhenotypes = await getAllPhenotypesHDR();
      let allPhenotypesShuffled = allPhenotypes
        .map(value => ({ value, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ value }) => value)
      for(let phenotype = 0; phenotype < Math.min(5, allPhenotypesShuffled.length); phenotype++) {
        expect(await importPhenotypeHDR(allPhenotypesShuffled[phenotype])).to.be.true;
      }
    }).timeout(0);

    it("[HDR3] Should be able to import all phenotypes from the HDR UK phenotype library API", async () => {
      expect(await importAllPhenotypesHDR()).to.be.true;
    }).timeout(0);

  });

});
