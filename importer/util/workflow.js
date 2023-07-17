const models = require('../models');
const logger = require('../config/winston');
const config = require('config');
const sequelize = require('sequelize');
const op = sequelize.Op;
const fs = require('fs').promises;
const got = require('got');

class Workflow {

  static async workflow(workflow) {
    try {
      let steps = await models.step.findAll({where:{workflowId:workflow.id}, order:[['position', 'ASC']]});
      let mergedSteps = [];
      for(let step of steps) {
        let mergedStep = JSON.parse(JSON.stringify(step));
        mergedStep.inputs = JSON.parse(JSON.stringify(await models.input.findAll({where:{stepId:step.id}})));
        mergedStep.outputs = JSON.parse(JSON.stringify(await models.output.findAll({where:{stepId:step.id}})));
        mergedStep.implementations = JSON.parse(JSON.stringify(await models.implementation.findAll({where: {stepId: step.id}, order:[['language', 'DESC']] })));
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

  static async deleteStepsFromWorkflow(workflowId) {
    try {
      let steps = await models.step.findAll({where:{workflowId:workflowId}});
      for(let step of steps) {
        try {
          let implementations = await models.implementation.findAll({where:{stepId:step.id}});
          for(let implementation of implementations) {
            if(implementation.fileName.includes(".")) await fs.unlink("uploads/"+workflowId+"/"+implementation.language+"/"+implementation.fileName);
          } 
        } catch(error) {
          logger.error("Error deleting implementation:"+error);
          return false;
        }
        try {
          await models.implementation.destroy({where:{stepId:step.id}});
        } catch(error) {
          logger.error("Error deleting implementation:"+error);
          return false;
        }
        try {
          await models.input.destroy({where:{stepId:step.id}});
        } catch(error) {
          logger.error("Error deleting input:"+error);
          return false;
        }
        try {
          await models.output.destroy({where:{stepId:step.id}});
        } catch(error) {
          logger.error("Error deleting output:"+error);
          return false;
        }
      }
      try {
        await models.step.destroy({where:{workflowId:workflowId}});
      } catch(error) {
        logger.error("Error deleting steps:"+error);
        return false;
      }
    } catch(error) {
      logger.error("Error getting steps to delete:"+error);
      return false;
    }
    return true;
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

  static async getParent(workflowId) {
    try {
      let child = await models.child.findOne({where:{workflowId:workflowId}});
      if(child&&child.parentId) {
        return child.parentId;
      } else {
        return false;
      }
    } catch(getParentError) {
      logger.error("Error getting child's parent: " + getParentError);
      return false;
    }
  }

  static async getFullWorkflow(workflowId, username, language=null, implementationUnits={}) {
    try {
      var workflow = JSON.parse(JSON.stringify(await models.workflow.findOne({where:{id:workflowId}})));
      if(!workflow) throw "Error finding workflow";
      if(workflow.userName!=username) throw "User does not own this workflow";
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
        if(language) { implementationCriteria.language = language; } else if (implementationUnits&&implementationUnits[step.name]) { implementationCriteria.language = implementationUnits[step.name]; }
        let allImplementations = await models.implementation.findAll({where: implementationCriteria, order:[["language", "DESC"]]});
        mergedStep.implementation = JSON.parse(JSON.stringify(allImplementations[0]));
        if(!mergedStep.implementation) throw "Error finding implementation: " + JSON.stringify(implementationCriteria);
        if(!implementationUnits[step.name]) implementationUnits[step.name] = mergedStep.implementation.language;
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

  static async generateWorkflow(workflowId, username, language=null, implementationUnits={}) {
    let workflow, generate;
    try {
      workflow = await Workflow.getFullWorkflow(workflowId, username, language, implementationUnits);
      // add steps from branches
      workflow.steps = await Promise.all(workflow.steps.map(async (workflowStep)=>!workflowStep.implementation.fileName.includes(".")?Object.assign(workflowStep, {"implementation":await Workflow.getFullWorkflow(workflowStep.implementation.fileName, username, language, implementationUnits)}):workflowStep));
    } catch(getFullWorkflowError) {
      logger.error("Error getting full workflow: " + getFullWorkflowError);
    }
    try {
      generate = await got.post(config.get("generator.URL") + "/generate", {json:workflow.steps, responseType:"json"});
    } catch(error) {
      logger.debug("Error contacting generator: "+error+" "+JSON.stringify(workflow.steps));
      return false;
    }
    if(generate.statusCode!=200 || !generate.body || !generate.body.steps) {
      logger.error("Content returned from generator not sufficient: " + JSON.stringify(generate.body||{}));
      return false;
    }
    // make implementation unit language selections for each branch and add to the parent language choices
    implementationUnits = Object.assign({}, implementationUnits, ...workflow.steps.map(step=>step.implementation.steps).filter(step=>step!=undefined).flat().filter(step=>!Object.keys(implementationUnits).includes(step.name)).map((step)=>({[step.name]: step.implementation.language})));
    if(generate.body.workflow&&generate.body.workflowInputs) {
      return {"workflow":workflow, "generate":generate, "implementationUnits":implementationUnits};
    } else {
      logger.debug("Error generating workflow.");
      return false;
    }
  }

}

module.exports = Workflow;
