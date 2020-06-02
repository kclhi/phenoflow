const models = require("../models");
const logger = require('../config/winston');
const config = require('config');
const sequelize = require('sequelize');
const op = sequelize.Op;

class Workflow {

  static async workflow(workflow) {

    try {
      let steps = await models.step.findAll({where:{workflowId:workflow.id}});
      let mergedSteps = [];
      for(let step of steps) {
        let mergedStep = JSON.parse(JSON.stringify(step));
        mergedStep.inputs = JSON.parse(JSON.stringify(await models.input.findAll({where:{stepId:step.id}})));
        mergedStep.outputs = JSON.parse(JSON.stringify(await models.output.findAll({where:{stepId:step.id}})));
        mergedStep.implementations = JSON.parse(JSON.stringify(await models.implementation.findAll({where: {stepId: step.id}})));
        mergedSteps.push(mergedStep);
      }
      workflow.steps = mergedSteps;
    } catch(error) {
      error = "Error getting workflow: " + error;
      logger.debug(error);
      throw error;
    }
    return workflow;

  }

  static async getWorkflow(workflowId) {

    try {
      var workflow = JSON.parse(JSON.stringify(await models.workflow.findOne({where:{id:workflowId}})));
      if(!workflow) throw "Error finding workflow";
      workflow = Workflow.workflow(workflow);
    } catch(error) {
      error = "Error getting workflow: " + error;
      logger.debug(error);
      throw error;
    }
    return workflow;

  }

  static async getRandomWorkflow() {

    try {
      let workflows = await models.workflow.findAll();
      if(!workflows) throw "Error finding workflows";
      var workflow = Workflow.workflow(JSON.parse(JSON.stringify(workflows[Math.floor(Math.random() * workflows.length)])));
    } catch(error) {
      error = "Error getting workflow: " + error;
      logger.debug(error);
      throw error;
    }
    return workflow;

  }

  static async completeWorkflows(category="", offset=0, limit=config.get("ui.PAGE_LIMIT")) {

    try {
      return await models.workflow.findAll({where:{[op.and]:[{complete:true},{[op.or]:[{about:{[op.like]:"%"+category+"%"}},{userName:{[op.like]:"%"+category+"%"}}]}]}, offset:offset, limit:limit, order: [['name', 'ASC']]});
    } catch(error) {
      error = "Error getting complete workflows: " + error;
      logger.debug(error);
      throw error;
    }

  }

  static async workflowComplete(workflowId) {

    try {
      let candidateWorkflow = await Workflow.getWorkflow(workflowId);
      let completeWorkflow = true;
      for(let step in candidateWorkflow.steps) {
        if((candidateWorkflow.steps[step].inputs&&!candidateWorkflow.steps[step].inputs[0])||(candidateWorkflow.steps[step].outputs&&!candidateWorkflow.steps[step].outputs[0])||(candidateWorkflow.steps[step].implementations&&!candidateWorkflow.steps[step].implementations[0])) {
          completeWorkflow = false;
          break;
        }
      }
      if(candidateWorkflow.steps[0]&&completeWorkflow) {
        await models.workflow.update({complete:true}, {where:{id:workflowId}});
      } else {
        await models.workflow.update({complete:false}, {where:{id:workflowId}});
      }
    } catch(error) {
      error = "Error marking workflow as (in)complete: " + error;
      logger.debug(error);
      throw error;
    }

  }

  static async getFullWorkflow(workflowId, language=null, implementationUnits=null) {

    try {
      var workflow = JSON.parse(JSON.stringify(await models.workflow.findOne({where:{id:workflowId}})));
      if(!workflow) throw "Error finding workflow";
      let steps = await models.step.findAll({where:{workflowId:workflow.id}});
      if(!steps) throw "Error finding steps";
      let mergedSteps = [];
      for(let step of steps) {
        let mergedStep = JSON.parse(JSON.stringify(step));
        mergedStep.inputs = JSON.parse(JSON.stringify(await models.input.findAll({where:{stepId:step.id}})));
        if(!mergedStep.inputs) throw "Error finding inputs";
        mergedStep.outputs = JSON.parse(JSON.stringify(await models.output.findAll({where:{stepId:step.id}})));
        if(!mergedStep.outputs) throw "Error finding outputs";
        let implementationCriteria = { stepId: step.id };
        if(language) { implementationCriteria.language = language; } else if (implementationUnits) { implementationCriteria.language = implementationUnits[step.name]; }
        mergedStep.implementation = JSON.parse(JSON.stringify(await models.implementation.findOne({where: implementationCriteria})));
        if(!mergedStep.implementation) throw "Error finding implementation: " + JSON.stringify(implementationCriteria);
        mergedSteps.push(mergedStep);
      }
      workflow.steps = mergedSteps;
    } catch(error) {
      error = "Error getting full workflow: " + error;
      logger.debug(error);
      throw error;
    }
    return workflow;

  }

}

module.exports = Workflow;
