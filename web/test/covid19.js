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

	describe("/POST create COVID-19 workflow", async() => {

		let workflowId;
		let name = "covid19";

		it("Create covid workflow.", async() => {
			workflowId = await Workflow.createWorkflow(name, "martinchapman", "COVID-19 (coronavirus) phenotype identifying cohorts based on controlled clinical terminology terms.");
		});

		// 1. read-potential-cases

		let stepId;

		it("Add read potential cases step.", async() => {
			stepId = await Workflow.upsertStep(workflowId, 1, "read-potential-cases", "Read potential cases", "load");
		});

		it("Add read potential cases input.", async() => {
			await Workflow.input(stepId, "Potential cases of covid-19.");
		});

		it("Add read potential cases output.", async() => {
			await Workflow.output(stepId, "Initial potential cases, read from disc.", "csv");
		});

		it("Add read potential cases implementation.", async() => {
			await Workflow.implementation(stepId, "python", "test/implementation/python/covid19/", "read-potential-cases.py");
		});

		async function covidCode(code, step) {

			let stepId;

			it("Add " + code + " step.", async() => {
				stepId = await Workflow.upsertStep(workflowId, step, code.replace("-", "").toLowerCase(), code + " codes used to record COVID-19 related events in electronic health records.", "logic");
			});

			it("Add " + code + " input.", async() => {
				await Workflow.input(stepId, "Potential cases of covid-19.");
			});

			it("Add " + code + " output.", async() => {
				await Workflow.output(stepId, "Patients with " + code + " codes indicating COVID-19 related events in electronic health record.", "csv");
			});

			it("Add " + code + " implementation.", async() => {
				await Workflow.implementation(stepId, "python", "test/implementation/python/covid19/", code.toLowerCase() + ".py");
			});

		}

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
			stepId = await Workflow.upsertStep(workflowId, 10, "output-cases", "Output cases.", "output");
		});

		it('Add output-cases input.', async() => {
			await Workflow.input(stepId, "Potential cases of covid-19.");
		});

		it('Add output-cases output.', async() => {
			await Workflow.output(stepId, "Output containing patients flagged as having covid-19.", "csv");
		});

		it('Add output-cases implementation.', async() => {
			await Workflow.implementation(stepId, "python", "test/implementation/python/covid19/", "output-cases.py");
		});

	});

});
