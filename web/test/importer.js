const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fsfull = require("fs");
const fs = require("fs").promises;
const got = require("got");
const proxyquire = require('proxyquire');
const m2js = require("markdown-to-json");
const parse = require('neat-csv');
const models = require("../models");
const logger = require("../config/winston");
const config = require("config");
const Download = require("../util/download");
const Workflow = require("./workflow");

describe("importer", () => {

	describe("/POST import csv", () => {

		it("Should be able to add a new user (csv).", async() => {
			const result = await models.user.create({name:"phenotype.id", password: config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://phenotype.id"});
			result.should.be.a("object");
		});

		async function importPhenotypeCSV(phenotypeFile) {

			const PATH = "test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/" + phenotypeFile;

			try {
				await fs.stat(PATH)
			} catch(error) {
				console.error(PATH+" does not exist.");
				return false;
			}

			var markdownContent = JSON.parse(m2js.parse([PATH], {width: 0}))[phenotypeFile.replace(".md", "")];
			if(!markdownContent.primary_care_code_lists) return true;
			let primaryCare;
			try {
				primaryCare = await fs.readFile("test/"+config.get("importer.CSV_FOLDER")+markdownContent.primary_care_code_lists);
			} catch(e) {
				console.error("Primary care code list does not exist.");
				return false;
			}
			var primaryCareCSV = await parse(primaryCare);
			var secondaryCareCSVs = [];
			if(!markdownContent.secondary_care_code_lists) return true;
			for(let secondaryCarePath of markdownContent.secondary_care_code_lists.split(", ")) {
				let secondaryCareSource;
				try {
					secondaryCareSource = await fs.readFile("test/"+config.get("importer.CSV_FOLDER")+secondaryCarePath);
				} catch(e) {
					console.error("Secondary care code list does not exist");
					return false;
				}
				let secondaryCareCSV = await parse(secondaryCareSource);
				secondaryCareCSVs = secondaryCareCSVs.concat(secondaryCareCSV);
			}
			let fullCSV = primaryCareCSV.concat(secondaryCareCSVs);
			let codeCategories = {};
			for(var row of fullCSV) {
				if (row["Readcode"]) {
					let category = row["Category"] + " - primary";
					if (!codeCategories[category]) codeCategories[category] = [];
					codeCategories[category].push(row["Readcode"]);
				} else if(row["ICD10code"]) {
					let category = row["Category"] + " - secondary";
					if (!codeCategories[category]) codeCategories[category] = [];
					codeCategories[category].push(row["ICD10code"]);
				}
			}
			const server = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
			let res = await chai.request(server).post("/phenoflow/importer").send({name:markdownContent.name, about:markdownContent.title, codeCategories:codeCategories, userName:"phenotype.id"});
			res.should.have.status(200);
			res.body.should.be.a("object");
			return true;

		}

		it("Should be able to import a phenotype CSV.", async() => {
			const phenotypeFile = "dementia.md";
			const PATH = "test/"+config.get("importer.CSV_FOLDER")+phenotypeFile;
			// Can't perform test if file doesn't exist.
			try { await fs.stat(PATH) } catch(error) { return true; }
			expect(await importPhenotypeCSV(phenotypeFile)).to.be.true;
		}).timeout(0);

		it("Should be able to import all phenotype CSVs.", async() => {
			const PATH = "test/phenotype-id.github.io/_phenotypes/";
			// Can't perform test if folder doesn't exist.
			try { await fs.stat(PATH) } catch(error) { return true; }
			for(let phenotypeFile of await fs.readdir("test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/")) await expect(await importPhenotypeCSV(phenotypeFile)).to.be.true;
		}).timeout(0);

		it("Should be able to add a new user (web).", async() => {
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
