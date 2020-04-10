const chai = require("chai");
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const fs = require("fs");
const models = require("../models");
const Utils = require("../util/utils")
const logger = require("../config/winston");

chai.use(require("chai-http"));

class Workflow {

	static async createWorkflow(name, author, about) {

		let res = await chai.request(server).post("/phenotype/new").send({
			name: name,
			author: author,
			about: about
		});
		res.should.have.status(200);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async updateWorkflow(id, name, author, about) {

		let res = await chai.request(server).post("/phenotype/update/" + id).send({
			name: name,
			author: author,
			about: about
		});
		res.should.have.status(200);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async step(name, doc, type, position, workflowId) {
		return await chai.request(server).post("/step/new").send({
			name: name,
			doc: doc,
			type: type,
			position: position,
			workflowId: workflowId
		});
	}

	static async addStep(name, doc, type, position, workflowId) {

		let res = await Workflow.step(name, doc, type, position, workflowId);
		res.should.have.status(200);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async notAddStep(name, doc, type, position, workflowId) {

		let res = await Workflow.step(name, doc, type, position, workflowId);
		res.should.have.status(500);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async updateStep(name, doc, type, newPosition, workflowId, position) {

		let res = await chai.request(server).post("/step/update/" + workflowId + "/" + position).send({
			name: name,
			doc: doc,
			type: type,
			position: newPosition
		});
		res.should.have.status(200);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async addInput(doc, stepId) {

		let res = await chai.request(server).post("/input/new").send({
			doc: doc,
			stepId: stepId
		});
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async updateInput(doc, stepId) {

		let res = await chai.request(server).post("/input/update/" + stepId).send({
			doc: doc
		});
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async addOutput(doc, extension, stepId) {

		let res = await chai.request(server).post("/output/new").send({
			doc: doc,
			extension: extension,
			stepId: stepId
		});
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async updateOutput(doc, extension, stepId) {

		let res = await chai.request(server).post("/output/update/" + stepId).send({
			doc: doc,
			extension: extension
		});
		if (res.text) logger.debug(res.text);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async addImplementation(language, path, filename, stepId) {

		let res = await chai.request(server).post("/implementation/new").attach(
			"implementation",
			path + filename,
			"../uploads/" + filename
		).field(
			"language", language
		).field(
			"stepId", stepId
		);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async updateImplementation(newLanguage, path, filename, stepId, language) {

		let res = await chai.request(server).post("/implementation/update/" + stepId + "/" + language).attach(
			"implementation",
			path + filename,
			"../uploads/" + filename
		).field(
			"language", newLanguage
		);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

}

module.exports = Workflow;
