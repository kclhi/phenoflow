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

	static async step(workflowId, position, name, doc, type) {

		return await chai.request(server).post("/step/" + workflowId + "/" + position).send({
			name: name,
			doc: doc,
			type: type
		});

	}

	static async upsertStep(workflowId, position, name, doc, type) {

		let res = await Workflow.step(workflowId, position, name, doc, type);
		if (!res.body.id) logger.debug(res.body);
		res.should.have.status(200);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async notUpsertStep(workflowId, position, name, doc, type) {

		let res = await Workflow.step(workflowId, position, name, doc, type);
		res.should.have.status(500);
		res.body.should.be.a("object");
		logger.debug(res.body.errors&&res.body.errors[0]&&res.body.errors[0].message?res.body.errors[0].message:res.body);

	}

	static async input(stepId, doc) {

		let res = await chai.request(server).post("/input/" + stepId).send({
			doc: doc
		});
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async output(stepId, doc, extension) {

		let res = await chai.request(server).post("/output/" + stepId).send({
			doc: doc,
			extension: extension
		});
		if (res.text) logger.debug(res.text);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async implementation(stepId, language, path, filename) {

		let res = await chai.request(server).post("/implementation/" + stepId + "/" + language).attach(
			"implementation",
			path + filename,
			"../uploads/" + filename
		);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

}

module.exports = Workflow;
