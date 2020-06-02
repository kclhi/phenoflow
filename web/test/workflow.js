const chai = require("chai");
const should = chai.should();
const expect = chai.expect;
const fs = require("fs");
var server = require("../app");
const models = require("../models");
const logger = require("../config/winston");
const proxyquire = require('proxyquire');

chai.use(require("chai-http"));

class Workflow {

	static async createWorkflow(name, about, userName) {

		const server = proxyquire('../app', {'./routes/workflow':proxyquire('../routes/workflow', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
		let res = await chai.request(server).post("/phenoflow/phenotype/new").send({name:name, about:about, userName: userName});
		res.should.have.status(200);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async updateWorkflow(id, name, about, userName="martinchapman") {

		const server = proxyquire('../app', {'./routes/workflow':proxyquire('../routes/workflow', {'express-jwt':(...args)=>{return (req, res, next)=>{req.user={}; req.user.sub=userName; return next();}}})});
		let res = await chai.request(server).post("/phenoflow/phenotype/update/" + id).send({name:name, about:about, userName:userName});
		res.should.have.status(200);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async step(workflowId, position, name, doc, type, userName="martinchapman") {

		const server = proxyquire('../app', {'./routes/step':proxyquire('../routes/step', {'express-jwt':(...args)=>{return (req, res, next)=>{req.user={}; req.user.sub=userName; return next();}}})});
		return await chai.request(server).post("/phenoflow/step/" + workflowId + "/" + position).send({name:name, doc:doc, type:type});

	}

	static async deleteStep(workflowId, position, userName="martinchapman") {

		const server = proxyquire('../app', {'./routes/step':proxyquire('../routes/step', {'express-jwt':(...args)=>{return (req, res, next)=>{req.user={}; req.user.sub=userName; return next();}}})});
		let res = await chai.request(server).post("/phenoflow/step/delete/" + workflowId + "/" + position);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async upsertStep(workflowId, position, name, doc, type, userName="martinchapman") {

		let res = await Workflow.step(workflowId, position, name, doc, type, userName);
		if (!res.body.id) logger.debug(res.body);
		res.should.have.status(200);
		res.body.should.be.a("object");
		return res.body.id;

	}

	static async notUpsertStep(workflowId, position, name, doc, type, userName="martinchapman") {

		let res = await Workflow.step(workflowId, position, name, doc, type, userName);
		res.should.have.status(500);
		res.body.should.be.a("object");
		logger.debug(res.body.errors&&res.body.errors[0]&&res.body.errors[0].message?res.body.errors[0].message:res.body);

	}

	static async input(stepId, doc, userName="martinchapman") {

		const server = proxyquire('../app', {'./routes/input':proxyquire('../routes/input', {'express-jwt':(...args)=>{return (req, res, next)=>{req.user={}; req.user.sub=userName; return next();}}})});
		let res = await chai.request(server).post("/phenoflow/input/" + stepId).send({doc:doc});
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async output(stepId, doc, extension, userName="martinchapman") {

		const server = proxyquire('../app', {'./routes/output':proxyquire('../routes/output', {'express-jwt':(...args)=>{return (req, res, next)=>{req.user={}; req.user.sub=userName; return next();}}})});
		let res = await chai.request(server).post("/phenoflow/output/" + stepId).send({doc:doc, extension:extension});
		if (res.text) logger.debug(res.text);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

	static async implementation(stepId, language, path, filename, userName="martinchapman") {

		const server = proxyquire('../app', {'./routes/implementation':proxyquire('../routes/implementation', {'express-jwt':(...args)=>{return (req, res, next)=>{req.user={}; req.user.sub=userName; return next();}}})});
		let res = await chai.request(server).post("/phenoflow/implementation/" + stepId + "/" + language).attach("implementation", path + filename, "../uploads/" + filename);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

}

module.exports = Workflow;
