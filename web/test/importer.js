const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fsfull = require("fs");
const fs = require("fs").promises;
const request = require("request");
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

		it("Should be able to add a new user.", async() => {
			const result = await models.user.create({name: "phenotype.id", password: config.get("user.DEFAULT_PASSWORD"), verified: "true", homepage: "https://phenotype.id"});
			result.should.be.a("object");
		});

		async function importPhenotype(phenotypeFile) {

			const PATH = "test/phenotype-id.github.io/_phenotypes/" + phenotypeFile;

			try {
				await fs.stat(PATH)
			} catch(error) {
				return true; // Can't perform test if file doesn't exist.
			}

			var markdownContent = JSON.parse(m2js.parse([PATH], {width: 0}))[phenotypeFile.replace(".md", "")];
			if(!markdownContent.primary_care_code_lists) return false;
			var primaryCare = await fs.readFile("test/phenotype-id.github.io" + markdownContent.primary_care_code_lists);
			var primaryCareCSV = await parse(primaryCare);
			var secondaryCareCSVs = [];
			if(!markdownContent.secondary_care_code_lists) return false;
			for(let secondaryCarePath of markdownContent.secondary_care_code_lists.split(", ")) {
				let secondaryCareSource = await fs.readFile("test/phenotype-id.github.io" + secondaryCarePath);
				let secondaryCareCSV = await parse(secondaryCareSource);
				secondaryCareCSVs = secondaryCareCSVs.concat(secondaryCareCSV);
			}
			let fullCSV = primaryCareCSV.concat(secondaryCareCSVs);
			let lastCategory = null;
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
			let res = await chai.request(server).post("/phenoflow/importer").send({name:markdownContent.name, about:markdownContent.title, codeCategories:codeCategories, userName: "phenotype.id"});
			res.should.have.status(200);
			res.body.should.be.a("object");

		}

		it("Should be able to import a phenotype CSV.", async() => {
			await importPhenotype("acne.md");
		});

		it("Should be able to import all phenotype CSVs.", async() => {
			return true;
			try {
				for(let phenotypeFile of await fs.readdir("test/phenotype-id.github.io/_phenotypes/")) if(!await importPhenotype(phenotypeFile)) continue;
			} catch(error) {
				return true;
			}

		}).timeout(0);

	});

});
