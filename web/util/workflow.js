const nlp = require('compromise');
nlp.extend(require('compromise-adjectives'));
const models = require('../models');
const logger = require('../config/winston');
const config = require('config');
const sequelize = require('sequelize');
const op = sequelize.Op;
const fs = require('fs').promises;

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

  static async completeWorkflows(category="", offset=0, limit=config.get("ui.PAGE_LIMIT"), getRestricted=false) {
    try {
      let workflows = await models.workflow.findAll({where:{complete:true, '$user.restricted$':getRestricted, [op.or]:[{name:{[op.like]:"%"+category+"%"}},{[op.or]:[{about:{[op.like]:"%"+category+"%"}},{userName:{[op.like]:"%"+category+"%"}}]}], [op.and]:[{'$parent.child.workflowId$':null}, {'$parent.child.parentId$':null}]}, include:[{model:models.workflow, as:"parent", required:false},{model:models.user}], order:[['name', 'ASC']]});
      return workflows.slice(offset, offset+limit);
    } catch(error) {
      error = "Error getting complete workflows: " + error;
      logger.debug(error);
      throw error;
    }
  }

  static async restrictedWorkflows(category="", offset=0, limit=config.get("ui.PAGE_LIMIT")) {
    return await this.completeWorkflows(category, offset, limit, true);
  }

  static async getRandomWorkflow() {
    try {
      let workflows = await this.completeWorkflows()
      workflows = workflows.map(workflow=>this.workflow(workflow));
      if(!workflows||!workflows.length) return false;
      return workflows[Math.floor(Math.random() * workflows.length)];
    } catch(error) {
      error = "Error getting workflow: " + error;
      logger.debug(error);
      throw error;
    }
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
        } catch(exception) {
          console.error("Error deleting implementation:"+error);
        }
        try {
          await models.implementation.destroy({where:{stepId:step.id}});
        } catch(exception) {
          console.error("Error deleting implementation:"+error);
        }
        try {
          await models.input.destroy({where:{stepId:step.id}});
        } catch(exception) {
          console.error("Error deleting input:"+error);
        }
        try {
          await models.output.destroy({where:{stepId:step.id}});
        } catch(exception) {
          console.error("Error deleting output:"+error);
        }
      }
      try {
        await models.step.destroy({where:{workflowId:workflowId}});
      } catch(exception) {
        console.error("Error deleting steps:"+error);
      }
    } catch(exception) {
      console.error("Error getting steps to delete:"+error);
    }
  }

  static async addChildrenToStep(workflow) {
    try {
      let children = await models.child.findAll({where:{parentId:workflow.id}});
      for(let child of children) {
        if(child.distinctStepPosition&&child.distinctStepName) {
          if(!workflow.steps[child.distinctStepPosition-1]) continue;
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

  // A workflow is defined as being a child of another if all but one of their steps overlap
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
        if(workflowSteps.length!=candidateChildSteps.length) continue;
        let distinctStepName, distinctStepPosition;
        for(let candidateChildStep of candidateChildSteps) {
          let workflowStep = null;
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
            if(candidateChildStepInput.doc==workflowStepInput.doc&&candidateChildStepOutput.doc==workflowStepOutput.doc&&candidateChildStepOutput.extension==workflowStepOutput.extension) { 
              matchingSteps++;
              continue;
            }
          }
          distinctStepName = candidateChildStep.name;
          distinctStepPosition = candidateChildStep.position;
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
        if(language) { implementationCriteria.language = language; } else if (implementationUnits&&implementationUnits[step.name]) { implementationCriteria.language = implementationUnits[step.name]; }
        let allImplementations = await models.implementation.findAll({where: implementationCriteria, order:[["language", "DESC"]]});
        mergedStep.implementation = JSON.parse(JSON.stringify(allImplementations[0]));
        if(!implementationUnits[step.name]) implementationUnits[step.name] = mergedStep.implementation.language;
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

  static ignoreInStepName(word) {
    let conditionSynonyms = ["syndrome", "infection", "infections", "disease", "diseases", "disorder", "disorders", "malignancy", "status", "diagnosis", "dysfunction", "accident", "difficulty", "symptom", "symptoms"];
    let ignoreWords = ["not", "use", "type", "using", "anything", "enjoying"];
    let nlpd = nlp(word);
    return word.length <= 2
      || conditionSynonyms.concat(ignoreWords).includes(word.toLowerCase()) 
      || nlpd.conjunctions().length>0
      || nlpd.prepositions().length>0 
      || nlpd.adverbs().length>0;
  }
  
  static isNegative(phrase) {
    phrase = phrase.toLowerCase();
    return nlp("is " + phrase).verbs().isNegative().length>0 || phrase.split(" ").filter(word=>word.startsWith("non")).length>0 || phrase.split(" ").filter(word=>word.startsWith("un")).length>0 || phrase.split(" ").includes("without");
  }

}

module.exports = Workflow;
