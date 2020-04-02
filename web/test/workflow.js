const chai = require('chai');
const server = require('../app');
const should = chai.should();
const expect = chai.expect;
const fs = require('fs');
const models = require('../models');
const Utils = require('../util/utils')
const logger = require('../config/winston');

chai.use(require('chai-http'));

class Workflow {

	static async createWorkflow(author, about) {

		await models.workflow.sync({force:true});
		let res = await chai.request(server).post('/workflow/new').send({
			author: author,
			about: about
		});
		res.should.have.status(200);
		res.body.should.be.a('object');
		return res.body.id;

	}

	static async addStep(stepId, doc, type, position, workflowId) {

		let res = await chai.request(server).post('/step/new').send({
			stepId: stepId,
			doc: doc,
			type: type,
			position: position,
			workflowId: workflowId
		});
		res.should.have.status(200);
		res.body.should.be.a('object');
		return res.body.id;

	}

	static async addInput(inputId, doc, stepId) {

		let res = await chai.request(server).post('/input/new').send({
			inputId: inputId,
			doc: doc,
			stepId: stepId
		});
		res.should.have.status(200);
		res.body.should.be.a('object');

	}

	static async addOutput(outputId, doc, extension, stepId) {

		let res = await chai.request(server).post('/output/new').send({
			outputId: outputId,
			doc: doc,
			extension: extension,
			stepId: stepId
		});
		res.should.have.status(200);
		res.body.should.be.a('object');

	}

	static async addImplementation(language, stepId) {

		let res = await chai.request(server).post('/implementation/new').attach(
			'implementation',
			'test/hello-world.py',
			'../uploads/hello-world.py'
		).field(
			'language', language
		).field(
			'stepId', stepId
		);
		res.should.have.status(200);
		res.body.should.be.a('object');

	}

}

module.exports = Workflow;
