const nlp = require('compromise')
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
const stringSimilarity = require("string-similarity");
const Download = require("../util/download");
const Workflow = require("./workflow");

describe("importer", () => {

    describe("/POST import csv", () => {

        it("Should be able to add a new user (csv).", async() => {
        	const result = await models.user.create({name:"caliber", password: config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://portal.caliberresearch.org"});
        	result.should.be.a("object");
        });

        function categorise(code, description, codeCategories, name, primary=true) {
            let placed=false;
            let primarySecondary = primary?" - primary":" - secondary";
            for(let existingCategory of Object.keys(codeCategories)) {
                // Don't mix primary and secondary category groups
                if(primary && existingCategory.indexOf("secondary")>-1) continue;
                let existingCategoryPrefix = existingCategory.replace(" " + name + primarySecondary, "");
                for(let term of description.split(" ")) {
                    term = nlp(term).nouns().toSingular().text() || term
                    if((existingCategoryPrefix.toLowerCase().indexOf(term.toLowerCase()) > -1
                        || term.toLowerCase().indexOf(existingCategoryPrefix.toLowerCase()) > -1
                        || stringSimilarity.compareTwoStrings(term.toLowerCase(), existingCategoryPrefix.toLowerCase()) >= 0.8
                        ) && term.length > 4) {
                            codeCategories[existingCategory].push(code);
                            if(term.toLowerCase()!=existingCategoryPrefix.toLowerCase()) {
                                let suffix = term.toLowerCase().replace(/[^a-zA-Z]/g, "").indexOf(name.toLowerCase().replace(/[^a-zA-Z]/g, ""))<0?" "+name:"";
                                codeCategories[term.charAt(0).toUpperCase() + term.slice(1) + suffix + primarySecondary] = codeCategories[existingCategory];;
                                delete codeCategories[existingCategory];
                            }
                            placed=true;
                            break;
                    }
                }
                if(placed) break;
            }
            let suffix = description.toLowerCase().replace(/[^a-zA-Z]/g, "").indexOf(name.toLowerCase().replace(/[^a-zA-Z]/g, ""))<0?" "+name:"";
            if(!placed) codeCategories[description.charAt(0).toUpperCase() + description.slice(1) + suffix + primarySecondary] = [code];
            return codeCategories;
        }

        async function importPhenotypeCSV(phenotypeFile) {

            const PATH = "test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/"+phenotypeFile;

            try {
                await fs.stat(PATH)
            } catch(error) {
                console.error(PATH+" does not exist.");
                return false;
            }

            try { 
                var markdownContent = JSON.parse(m2js.parse([PATH], {width: 0}))[phenotypeFile.replace(".md", "")];
            } catch(error) {
                console.error(phenotypeFile+": "+error);
                return false;
            }

            if(!markdownContent.codelists) return true;

            if(!Array.isArray(markdownContent.codelists)) markdownContent.codelists = [markdownContent.codelists];
            let fullCSV;

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

            if(!fullCSV) return false;
            let codeCategories = {};
            let hasCategory = ["readcode", "snomedconceptid", "icdcode", "icd10code", "icd11code", "opcs4code"];
            let toCategorise = ["readv2code", "snomedctconceptid"];
            let codingSystems = ["Read", "ICD-9", "ICD-10"];
            for(let row of fullCSV) {
                // Remove special characters from keys that prevent indexing
                for (const [key, value] of Object.entries(row)) {
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
                if((hasCategoryKeys = keys.filter(value => hasCategory.includes(value))) && hasCategoryKeys.length) {
                    let category = (row["category"]||row["calibercategory"]||markdownContent.name) + ((hasCategoryKeys[0].indexOf("read")>-1||hasCategoryKeys[0].indexOf("snomed")>-1)?" - primary":" - secondary");
                    if(!codeCategories[category]) codeCategories[category] = [];
                    value = getFirstUsableValue(hasCategoryKeys, row);
                    if(value) { codeCategories[category].push(value) } else { return false };
                } else if(row["codingsystem"] && codingSystems.indexOf(row["codingSystem"])) {
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
                    console.error("No handler in " + phenotypeFile + " codelist for: " + JSON.stringify(row));
                    return false;
                }
            }

            if(Object.keys(codeCategories).indexOf("undefined - primary") > -1 || Object.keys(codeCategories).indexOf("undefined - secondary") > -1) {
                console.error("No category for " + markdownContent.name + ": " + JSON.stringify(codeCategories));
                return false;
            }

            const server = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
            let res = await chai.request(server).post("/phenoflow/importer").send({name:markdownContent.name, about:markdownContent.title, codeCategories:codeCategories, userName:"caliber"});
            res.should.have.status(200);
            res.body.should.be.a("object");
            return true;
        }

        // it("Should be able to import a phenotype CSV.", async() => {
        //     const phenotypeFile = "kuan_enthesopathy_95ZhQE7diuRQwsqRn8UrmT.md";
        //     const PATH = "test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/"+phenotypeFile;
        //     // Can't perform test if file doesn't exist.
        //     try { await fs.stat(PATH) } catch(error) { return true; }
        //     expect(await importPhenotypeCSV(phenotypeFile)).to.be.true;
        // }).timeout(0);

        it("Should be able to import all phenotype CSVs.", async() => {
        	const PATH = "test/phenotype-id.github.io/_phenotypes/";
        	// Can't perform test if folder doesn't exist.
        	try { await fs.stat(PATH) } catch(error) { return true; }
        	for(let phenotypeFile of await fs.readdir("test/"+config.get("importer.CSV_FOLDER")+"/_phenotypes/")) expect(await importPhenotypeCSV(phenotypeFile)).to.be.true;
        }).timeout(0);

    });

});
