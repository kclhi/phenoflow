const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fsfull = require("fs");
const fs = require("fs").promises;
const got = require("got");
const proxyquire = require('proxyquire');
const models = require("../models");
const logger = require("../config/winston");
const config = require("config");
const Download = require("../util/download");
const Workflow = require("./workflow");

describe("web", () => {

    describe("/POST import web", () => {

        it("Should be able to add a new user.", async() => {
        	const result = await models.user.create({name:"sail", password: config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://saildatabank.com"});
        	result.should.be.a("object");
        });

        async function importPhenotypeWeb(phenotypeId) {

            if(!config.has("importer.SAIL_USERNAME")||!config.has("importer.SAIL_PASSWORD")) return false;
            const options = {headers:{"Authorization":"Basic "+Buffer.from(config.get("importer.SAIL_USERNAME")+":"+config.get("importer.SAIL_PASSWORD")).toString("base64")}};
            let records;
            if(!phenotypeId) records = await got.get(config.get("importer.SAIL_API")+"/concepts", options).json();
            if(!phenotypeId&&!records) return false;
            for(let id=(phenotypeId?phenotypeId:0);id<=(phenotypeId?phenotypeId:records.length);id++) {
                let phenotype;
                try {
                    phenotype = await got.get(config.get("importer.SAIL_API")+"/export_workingset_codes/"+id+"/?format=json", options).json();
                } catch(error) {
                    if(error.response.statusCode==403) {
                        console.error("Incorrect credentials.");
                        //return false; ~MDC leave as warning for now, as unauthorised just skipped.
                    }
                    continue;
                }
                let conceptId, category, details, codeCategories = {};
                let about = phenotype[0].working_set_name;
                if(about.indexOf("PHE")<0) continue;
                let name = phenotype[0].working_set_name.match(/.*PHE[0-9]*\s\-\s(.*)/)[1];
                const codeTranslate = {5:"read", 4:"icd10", 7:"opcs4"};
                for(code of phenotype) {
                    if (conceptId != code.concept_id) {
                        details = await got.get(config.get("importer.SAIL_API")+"/concepts/" + code.concept_id, options).json();
                        conceptId = code.concept_id;
                    }
                    if(!codeTranslate[details.coding_system]) console.error("Unrecognised coding system: " + details.coding_system);
                    let category = name + " using " + codeTranslate[details.coding_system] + " codes - " + (code.concept_name.match(/.*\-.*\-\s(.*)/)[1].toLowerCase().replace(" care", ""));
                    if (!codeCategories[category]) codeCategories[category] = [];
                    codeCategories[category].push(code.code);
                }
                const server = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
                let res = await chai.request(server).post("/phenoflow/importer").send({name:name, about:about, codeCategories:codeCategories, userName:"sail"});
                res.should.have.status(200);
                res.body.should.be.a("object");
            }
            return true;

        }

        it("Should be able to import a phenotype from the web.", async() => {
        	// Can't perform test if credentials not available.
        	if(!config.has("importer.SAIL_USERNAME")||!config.has("importer.SAIL_PASSWORD")) return true;
        	expect(await importPhenotypeWeb(94)).to.be.true;
        }).timeout(0);
        
        it("Should be able to import all phenotypes from the web.", async() => {
        	if(!config.has("importer.SAIL_USERNAME")||!config.has("importer.SAIL_PASSWORD")) return true;
        	expect(await importPhenotypeWeb()).to.be.true;
        }).timeout(0);

    });

});
