const models = require("../models");
const logger = require('../config/winston');
const config = require('config');
const sequelize = require('sequelize');
const op = sequelize.Op;

class Workflow {

  static async workflow(workflow) {

    try {
      let steps = await models.step.findAll({where:{workflowId:workflow.id}, order:[['position', 'ASC']]});
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
      let workflows = await models.workflow.findAll({where:{complete:true, [op.or]:[{about:{[op.like]:"%"+category+"%"}},{userName:{[op.like]:"%"+category+"%"}}], [op.and]:[{'$parent.child.workflowId$':null}, {'$parent.child.parentId$':null}]}, include:[{model:models.workflow, as:"parent", required:false}], order:[['name', 'ASC']]})
      return workflows.slice(offset, offset+limit);
    } catch(error) {
      error = "Error getting complete workflows: " + error;
      logger.debug(error);
      throw error;
    }

  }

  static async addChildrenToStep(workflow) {

    try {
      let children = await models.child.findAll({where:{parentId:workflow.id}});
      for(let child of children) {
        if(child.distinctStepPosition&&child.distinctStepName) {
          if(!workflow.steps[child.distinctStepPosition-1].children) workflow.steps[child.distinctStepPosition-1].children = [];
          workflow.steps[child.distinctStepPosition-1].children.push({workflowId:child.workflowId, stepName:child.distinctStepName});
        }
      }
      return workflow;
    } catch(error) {
      error = "Error getting workflow siblings: " + error;
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

  // A workflow is defined as being a child of another if all but one of their steps overlap OR if all of their steps overlap.
  static async workflowChild(workflowId, exhaustive=false) {

    let workflows = await models.workflow.findAll();
    if(!workflows.filter(workflow=>workflow.id==workflowId).length) return;
    const children = await models.child.findAll({where:{parentId:workflowId}});
    // Can't be child of workflow that already parent of.
    workflows = workflows.filter(workflow=>children.map(child=>child.workflowId).indexOf(workflow.id)<0);
    // Non-exhaustive searches only examine potential parent workflows with the same name.
    if(!exhaustive) workflows = workflows.filter(workflow=>workflow.name==workflows.filter((workflow)=>{return workflow.id==workflowId})[0].name);
    const candidateChildSteps = await models.step.findAll({where:{workflowId:workflowId}});
    if (!candidateChildSteps) throw new Error(ERROR_PREFIX + "Error getting candidate workflow steps.");
    for(let workflow of workflows) {
      let matchingSteps = 0;
      if(workflowId!=workflow.id) {
        const ERROR_PREFIX = "Unable to identify workflow intersection: ";
        const workflowSteps = await models.step.findAll({where:{workflowId:workflow.id}});
        if(!workflowSteps) throw new Error(ERROR_PREFIX + "Error getting other workflow steps.");
        let distinctStepName, distinctStepPosition;
        for(let candidateChildStep of candidateChildSteps) {
          let workflowStep = null;
          distinctStepName = candidateChildStep.name;
          distinctStepPosition = candidateChildStep.position;
          if((workflowStep=workflowSteps.filter((step)=>{return candidateChildStep.name==step.name&&candidateChildStep.doc==step.doc&&candidateChildStep.type==step.type})) && workflowStep.length) {
            // ~MDC Again, eventually there may be multiple inputs and outputs.
            let candidateChildStepInput=await models.input.findOne({where:{stepId:candidateChildStep.id}});
            if(!candidateChildStepInput) throw new Error(ERROR_PREFIX + "Error getting candidate child step input.");
            let candidateChildStepOutput=await models.output.findOne({where:{stepId:candidateChildStep.id}});
            if(!candidateChildStepOutput) throw new Error(ERROR_PREFIX + "Error getting candidate child step output.");
            let workflowStepInput = await models.input.findOne({where:{stepId:workflowStep[0].id}});
            if(!workflowStepInput) throw new Error(ERROR_PREFIX + "Error getting workflow step input.");
            let workflowStepOutput = await models.output.findOne({where:{stepId:workflowStep[0].id}});
            if(!workflowStepOutput) throw new Error(ERROR_PREFIX + "Error getting workflow step output.");
            if(candidateChildStepInput.doc==workflowStepInput.doc&&candidateChildStepOutput.doc==workflowStepOutput.doc&&candidateChildStepOutput.extension==workflowStepOutput.extension) matchingSteps++;
          }
        }
  
        if(distinctStepName&&distinctStepPosition
          &&(matchingSteps==candidateChildSteps.length||matchingSteps==workflowSteps.length-1)
          // We aren't able to tell if 3-step workflows are children via a middle distinct step.
          &&!(matchingSteps==2&&!distinctStepName.includes("read")&&!distinctStepName.includes("output"))
          ) await workflows.filter((workflow)=>{return workflow.id==workflowId})[0].addParent(workflow, {through:{name:workflow.name, distinctStepName:distinctStepName, distinctStepPosition:distinctStepPosition}});
      }
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
