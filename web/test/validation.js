const chai = require('chai');
chai.use(require('chai-http'));
const server = require('../app');
const should = chai.should();
const expect = chai.expect;
const fs = require('fs');
const request = require('request');
const got = require('got');
const models = require('../models');
const logger = require('../config/winston');
const config = require('config');
const Workflow = require('./workflow');

describe('validation', () => {

	describe('/POST create workflow', () => {

		let workflowId, secondWorkflowId;
		let name = "workflow";

		it('Should be able to create workflow.', async() => {
			await models.workflow.sync({force:true});
			workflowId = await Workflow.createWorkflow(name, "martin", "this is a special phenotype");
		});

		it('Should be able to create second workflow.', async() => {
			secondWorkflowId = await Workflow.createWorkflow(name, "martin", "this is another special phenotype");
		});

		let stepId;

		it('Should be able to create step with unique id + workflow + position.', async() => {
			await models.step.sync({force:true});
			stepId = await Workflow.upsertStep(workflowId, 1, "stepId-" + 1, "doc", "type");
		});

		it('Should be able to create another step with unique id + workflow + position.', async() => {
			await Workflow.upsertStep(workflowId, 2, "stepId-" + 2, "doc", "type");
		});

		it('Should be able to create same step with different workflow.', async() => {
			await Workflow.upsertStep(secondWorkflowId, 1, "stepId-" + 1, "doc", "type");
		});

		it('Step with same id + workflow + position should update', async() => {
			await Workflow.upsertStep(workflowId, 1, "stepId-" + 1, "newDoc", "newType");
		});

		it('Should not be able to add step with same id + workflow', async() => {
			await Workflow.notUpsertStep(workflowId, 2, "stepId-" + 1, "doc", "type");
		});

		it('Should not be able to create another step with unique id + workflow and same position as previous step', async() => {
			await Workflow.notUpsertStep(workflowId, 1, "stepId-" + 2, "doc", "type");
		});

	});

});
