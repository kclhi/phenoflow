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
const Utils = require('../util/utils');
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
			logger.debug(secondWorkflowId);
		});

		let stepId;

		it('Should be able to create step with unique id + workflow + position.', async() => {
			await models.step.sync({force:true});
			stepId = await Workflow.addStep("stepId-" + 1, "doc", "type", 1, workflowId);
		});

		it('Should be able to create another step with unique id + workflow + position.', async() => {
			await Workflow.addStep("stepId-" + 2, "doc", "type", 2, workflowId);
		});

		it('Should be able to create same step with different workflow.', async() => {
			await Workflow.addStep("stepId-" + 1, "doc", "type", 1, secondWorkflowId);
		});

		it('Should not be able to add step with same id + workflow + position', async() => {
			await Workflow.notAddStep("stepId-" + 1, "doc", "type", 1, workflowId);
		});

		it('Should not be able to add step with same id + workflow', async() => {
			await Workflow.notAddStep("stepId-" + 1, "doc", "type", 2, workflowId);
		});

		it('Should not be able to create another step with unique id + workflow and same position as previous step', async() => {
			await Workflow.notAddStep("stepId-" + 2, "doc", "type", 1, workflowId);
		});

	});

});
