const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fs = require("fs");
const got = require("got");
const models = require("../models");
const logger = require("../config/winston");
const config = require("config");
const Workflow = require("./workflow");

describe("covid19", () => {

	let workflowId, stepId;
	const NAME = "covid19";
	const USERNAME = "covid19-phenomics";

	describe("/POST create COVID-19 workflow", async() => {

		async function covidCode(code, step) {

			it("Add " + code + " step.", async() => {
				stepId = await Workflow.upsertStep(workflowId, step, code.replace("-", "").toLowerCase(), "Use " + code + " codes to identify COVID-19 related events in a patient's electronic health record.", "logic", USERNAME);
			});

			it("Add " + code + " input.", async() => {
				await Workflow.input(stepId, "Potential cases of covid-19.", USERNAME);
			});

			it("Add " + code + " output.", async() => {
				await Workflow.output(stepId, "Patients with " + code + " codes indicating COVID-19 related events in electronic health record.", "csv", USERNAME);
			});

			it("Add " + code + " implementation.", async() => {
				await Workflow.implementation(stepId, "python", "test/implementation/python/covid19/", code.toLowerCase() + ".py", USERNAME);
			});

		}

		async function createCOVIDPhenotype() {

			// 2 - 9. Codes
			covidCode("ICD-10", 2);
			covidCode("ICD-11", 3);
			covidCode("CTV3", 4);
			covidCode("EMIS", 5);
			covidCode("Vision", 6);
			covidCode("SNOMED-UK", 7);
			covidCode("SNOMED-INTL", 8);
			covidCode("LOINC", 9);

			// 8. output-cases

			it('Add output-cases step.', async() => {
				stepId = await Workflow.upsertStep(workflowId, 10, "output-cases", "Output cases.", "output", USERNAME);
			});

			it('Add output-cases input.', async() => {
				await Workflow.input(stepId, "Potential cases of covid-19.", USERNAME);
			});

			it('Add output-cases output.', async() => {
				await Workflow.output(stepId, "Output containing patients flagged as having covid-19.", "csv", USERNAME);
			});

			it('Add output-cases implementation.', async() => {
				await Workflow.implementation(stepId, "python", "test/implementation/python/covid19/", "output-cases.py", USERNAME);
			});

		}

		async function createInput(targetDatasource, implementationLangauge, implementationLangaugeExtension) {

			// 1. read-potential-cases

			it("Add read potential cases step (" + targetDatasource + ").", async() => {
				stepId = await Workflow.upsertStep(workflowId, 1, "read-potential-cases-" + targetDatasource, "Read potential cases from " + targetDatasource, "load", USERNAME);
			});

			it("Add read potential cases input (" + targetDatasource + ").", async() => {
				await Workflow.input(stepId, "Potential cases of covid-19.", USERNAME);
			});

			it("Add read potential cases output (" + targetDatasource + ").", async() => {
				await Workflow.output(stepId, "Initial potential cases, read from " + targetDatasource + ".", "csv", USERNAME);
			});

			it("Add read potential cases implementation (" + targetDatasource + ").", async() => {
				await Workflow.implementation(stepId, implementationLangauge, "test/implementation/" + implementationLangauge + "/covid19/" + targetDatasource + "/", "read-potential-cases-" + targetDatasource + "." + implementationLangaugeExtension, USERNAME);
			});

		}

		it("Should be able to add a new user.", async() => {
			const result = await models.user.create({name: USERNAME, password: config.get("user.DEFAULT_PASSWORD"), verified: "true", homepage: "http://covid19-phenomics.org/"});
			result.should.be.a("object");
		});

		// First COVID phenotype

		it("Create covid workflow.", async() => {
			workflowId = await Workflow.createWorkflow(NAME, "COVID-19 (coronavirus).", USERNAME);
		});

		createInput("disc", "python", "py");

		createCOVIDPhenotype();

		// Second COVID phenotype

		it("Create covid workflow (i2b2).", async() => {
			workflowId = await Workflow.createWorkflow(NAME, "COVID-19 (coronavirus).", USERNAME);
		});

		createInput("i2b2", "js", "js");

		createCOVIDPhenotype();

		// Third COVID phenotype

		it("Create covid workflow (omop).", async() => {
			workflowId = await Workflow.createWorkflow(NAME, "COVID-19 (coronavirus).", USERNAME);
		});

		createInput("omop", "js", "js");

		createCOVIDPhenotype();

	});

});
