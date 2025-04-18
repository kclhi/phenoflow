const chai = require("chai");
const should = chai.should();
const logger = require("../config/winston");
const proxyquire = require('proxyquire');

const { v1: uuidv1 } = require("uuid");
const models = require("../models");
const WorkflowUtils = require("../util/workflow");

chai.use(require("chai-http"));

class Workflow {

	static async createWorkflow(name, about, userName, id=null) {
    should.exist(name);
    should.exist(about);
    should.exist(userName);
    if(!id) id = uuidv1();
    try {
      let workflow = await models.workflow.create({id:id, name:name, about:about, userName:userName});
      return workflow.id;
    } catch(error) {
      error = "Error adding workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      return should.fail(error);
    }
	}

	static async updateWorkflow(id, name, about, userName="martinchapman") {
    if(!name||!about||!userName) return should.fail('');
    try {
      let workflow = await models.workflow.findOne({where:{id:id}});
      if(!(workflow.userName==userName)) return should.fail('')
      await models.workflow.upsert({id:id, name:name, about:about, userName:userName});
    } catch(error) {
      error = "Error updating workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      return should.fail(error);
    }
	}

  static async #addStep(workflowId, position, name, doc, type, userName="martinchapman") {
    let workflow = await models.workflow.findOne({where:{id:workflowId}});
    if (!workflow) {
      let error = "No workflow linked to step.";
      logger.debug(error);
      return should.fail(error);
    }
    if(!(workflow.userName==userName)) return should.fail('');
    await models.step.upsert({name:name, doc:doc, type:type, workflowId:workflowId, position:position});
    let stepId = await models.step.findOne({where:{workflowId:workflowId, position:position}});
    await WorkflowUtils.workflowComplete(workflow.id);
    return stepId.id;
  }

	static async step(workflowId, position, name, doc, type, userName="martinchapman") {
    should.exist(name);
    should.exist(doc);
    should.exist(type);
    should.exist(userName);
    try {
      return await Workflow.#addStep(workflowId, position, name, doc, type, userName);        
    } catch(error) {
      error = "Error adding step: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      return should.fail(error);
    }
	}

	static async deleteStep(workflowId, position, userName="martinchapman") {
    try {
      await models.step.destroy({where:{workflowId:workflowId, position:position}});
      let stepId = await models.step.findOne({where:{workflowId:workflowId, position:position}});
      await models.input.destroy({where:{stepId:stepId}});
      await models.output.destroy({where:{stepId:stepId}});
      await models.implementation.destroy({where:{stepId:stepId}});
      await WorkflowUtils.workflowComplete(workflowId);
      return true;
    } catch(error) {
      error = "Error deleting step: " + (error&&error.errors&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      return should.fail(error);
    }
	}

	static async upsertStep(workflowId, position, name, doc, type, userName="martinchapman") {
		let id = await Workflow.step(workflowId, position, name, doc, type, userName);
		should.exist(id);
		return id;
	}

	static async notUpsertStep(workflowId, position, name, doc, type, userName="martinchapman") {
    should.exist(name);
    should.exist(doc);
    should.exist(type);
    should.exist(userName);
    try {
      await Workflow.#addStep(workflowId, position, name, doc, type, userName);        
    } catch(error) {
      return;
    }
    return should.fail('');
	}

	static async input(stepId, doc, userName="martinchapman") {
    should.exist(stepId);
    should.exist(doc);
    should.exist(userName);
    try {
      let step = await models.step.findOne({where:{id:stepId}});
      if (!step) return should.fail('');
      let workflow = await models.workflow.findOne({where:{id:step.workflowId}});
      if (!workflow) return should.fail('');
      if(!(workflow.userName==userName)) return should.fail('');
      await models.input.upsert({doc:doc, stepId:stepId});
      await WorkflowUtils.workflowComplete(workflow.id);
    } catch(error) {
      error = "Error adding input: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      return should.fail(error);
    }
	}

	static async output(stepId, doc, extension, userName="martinchapman") {
    should.exist(doc);
    should.exist(extension);
    should.exist(userName);
    try {
      let step = await models.step.findOne({where:{id:stepId}});
      if (!step) return should.fail('');
      let workflow = await models.workflow.findOne({where:{id:step.workflowId}});
      if (!workflow) return should.fail('');
      if(!(workflow.userName==userName)) return should.fail('');
      await models.output.upsert({doc:doc, extension:extension, stepId:stepId});
      await WorkflowUtils.workflowComplete(workflow.id);
    } catch(error) {
      error = "Error adding output: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      return should.fail(error);
    }
	}

	static async implementation(stepId, language, path, filename, userName="martinchapman") {

		const server = proxyquire('../app', {'./routes/implementation':proxyquire('../routes/implementation', {'express-jwt': { expressjwt(...args) {return (req, res, next)=>{req.user={}; req.user.sub=userName; return next();}}}})});
		let res = await chai.request(server).post("/phenoflow/implementation/" + stepId + "/" + language).attach("implementation", path + filename, "../uploads/" + filename);
		res.should.have.status(200);
		res.body.should.be.a("object");

	}

}

module.exports = Workflow;
