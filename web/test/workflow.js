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

	static async createWorkflow(name, author, about) {

		await models.workflow.sync({force:true});
		let res = await chai.request(server).post('/phenotype/new').send({
			name: name,
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

	static async addInput(doc, stepId) {

		let res = await chai.request(server).post('/input/new').send({
			doc: doc,
			stepId: stepId
		});
		res.should.have.status(200);
		res.body.should.be.a('object');

	}

	static async addOutput(doc, extension, stepId) {

		let res = await chai.request(server).post('/output/new').send({
			doc: doc,
			extension: extension,
			stepId: stepId
		});
		res.should.have.status(200);
		res.body.should.be.a('object');

	}

	static async addImplementation(language, stepId, path, filename) {

		let res = await chai.request(server).post('/implementation/new').attach(
			'implementation',
			path + filename,
			'../uploads/' + filename
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
