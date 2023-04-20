const chai = require('chai');
chai.use(require('chai-http'));
const server = require('../app');
const should = chai.should();
const expect = chai.expect;
const fs = require('fs');
const got = require('got');
const models = require('../models');
const logger = require('../config/winston');
const config = require('config');
const Workflow = require('./workflow');

describe('otitis', () => {

	describe('/POST create Otitis Media workflow', () => {

		let workflowId, stepId;
		const NAME = "otitis";
		const USERNAME = "rest";

		it("Should be able to add a new user.", async() => {
			const result = await models.user.create({name:USERNAME, password:config.get("user.DEFAULT_PASSWORD"), verified:"true", homepage:"https://www.rest-study.uk/"});
			result.should.be.a("object");
		});

		// 1. read-potential-cases
		it('Create Otitis workflow.', async() => {
			workflowId = await Workflow.createWorkflow(NAME, "Otitis media (REST trial cohort)", "rest", USERNAME);
		});

		it("Add read potential cases step (xml).", async() => {
			stepId = await Workflow.upsertStep(workflowId, 1, "read-potential-cases", "Read potential cases from XML", "load", USERNAME);
		});

		it("Add read potential cases input (XML).", async() => {
			await Workflow.input(stepId, "Potential cases of otitis.", USERNAME);
		});

		it("Add read potential cases output (XML).", async() => {
			await Workflow.output(stepId, "Initial potential cases, read from XML.", "csv", USERNAME);
		});

		it("Add read potential cases implementation (XML).", async() => {
			await Workflow.implementation(stepId, "js", "test/fixtures/otitis/js/", "read-potential-cases-xml.js", USERNAME);
		});

		// 2. Age check
		it('Add age step.', async() => {
			stepId = await Workflow.upsertStep(workflowId, 2, "age", "Determine whether the patient falls within the age range required for the specific trial cohort.", "logic", USERNAME);
		});

		it('Add age input.', async() => {
			await Workflow.input(stepId, "Potential cases of otitis media.", USERNAME);
		});

		it('Add age output.', async() => {
			await Workflow.output(stepId, "Output of patients flagged as being the correct age for the cohort.", "csv", USERNAME);
		});

		it('Add age implementation.', async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/otitis/python/", "age.py", USERNAME);
		});

		// 3. Code check
		it('Add code step.', async() => {
			stepId = await Workflow.upsertStep(workflowId, 3, "ctv3", "Determine whether the patient is annotated with a code indicating they are eligible for the trial cohort.", "logic", USERNAME);
		});

		it('Add code input.', async() => {
			await Workflow.input(stepId, "Potential cases of otitis media, within correct age.", USERNAME);
		});

		it('Add code output.', async() => {
			await Workflow.output(stepId, "Output of patients flagged as having otitis media for this cohort.", "csv", USERNAME);
		});

		it('Add code implementation.', async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/otitis/python/", "ctv3.py", USERNAME);
		});

		// 4. Output
		it('Add output-cases step.', async() => {
			stepId = await Workflow.upsertStep(workflowId, 4, "output-cases", "Output cases.", "output", USERNAME);
		});

		it('Add output-cases input.', async() => {
			await Workflow.input(stepId, "Patients flagged as having otitis media for this cohort.", USERNAME);
		});

		it('Add output-cases output.', async() => {
			await Workflow.output(stepId, "Output containing patients flagged as having otitis media for this cohort.", "csv", USERNAME);
		});

		it('Add output-cases implementation.', async() => {
			await Workflow.implementation(stepId, "python", "test/fixtures/otitis/python/", "output-cases.py", USERNAME);
		});

	});

});
