const nlp = require('compromise');
nlp.extend(require('compromise-adjectives'));
const models = require('../models');
const logger = require('../config/winston');
const config = require('config');
const sequelize = require('sequelize');
const op = sequelize.Op;
const stringSimilarity = require('string-similarity');
const got = require('got');
const fs = require('fs');
const fspromises = require('fs').promises;
const { exit } = require('process');

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
      let workflows = await models.workflow.findAll({where:{complete:true, [op.or]:[{name:{[op.like]:"%"+category+"%"}},{[op.or]:[{about:{[op.like]:"%"+category+"%"}},{userName:{[op.like]:"%"+category+"%"}}]}], [op.and]:[{'$parent.child.workflowId$':null}, {'$parent.child.parentId$':null}]}, include:[{model:models.workflow, as:"parent", required:false}], order:[['name', 'ASC']]});
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

  static ignoreInStepName(word) {
    let conditionSynonyms = ["syndrome", "infection", "infections", "disease", "diseases", "disorder", "disorders", "malignancy", "status", "diagnosis", "dysfunction", "accident"];
    let ignoreWords = ["not", "use", "type"];
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

  static workflowStepAnalysis(workflowA, workflowStepA, workflowB, workflowStepB) {
    const SIMILARITY_THRESHOLD = 0.8;
    for(let workflowStepANameComponent of workflowStepA.name.split("---")[0].split("-")) {
      if(this.ignoreInStepName(workflowStepANameComponent)) continue;
      for(let workflowStepBNameComponent of workflowStepB.name.split("---")[0].split("-")) {
        if(this.ignoreInStepName(workflowStepBNameComponent)) continue;
        if((workflowA.name.toLowerCase().includes(workflowStepANameComponent.toLowerCase()) && workflowB.name.toLowerCase().includes(workflowStepBNameComponent.toLowerCase())) || (workflowStepANameComponent.toLowerCase().includes(workflowA.name.toLowerCase()) && workflowStepBNameComponent.toLowerCase().includes(workflowB.name.toLowerCase()))) return false;
        return stringSimilarity.compareTwoStrings(workflowStepANameComponent, workflowStepBNameComponent) > SIMILARITY_THRESHOLD;
      }
    }
    return false;
  }

  static samePhenotype(nameA, nameB) {
    function clean(input) { return input.toLowerCase().replace(/[^a-zA-Z]/g, ""); }
    nameA = nameA.split("-").filter(word=>!Workflow.ignoreInStepName(word)).join(" ");
    nameB = nameB.split("-").filter(word=>!Workflow.ignoreInStepName(word)).join(" ");
    return clean(nameA)==clean(nameB);
  }

  static async workflowOverlap(workflows) {
    let overlap={}, iteration=1;
    for(let workflowA of workflows) {
      for(let workflowB of workflows) {
        console.log(Math.round((iteration++/(workflows.length*workflows.length))*100)+"%"); 
        if(workflowA.id!=workflowB.id && this.samePhenotype(workflowA.name, workflowB.name)) {
          let key = workflowA.name+"_"+workflowA.id+"_"+workflowA.userName+"-"+workflowB.name+"_"+workflowB.id+"_"+workflowB.userName;
          if(!Object.keys(overlap).includes(key)) overlap[key] = [];
          const workflowStepsA = await models.step.findAll({where:{workflowId:workflowA.id}});
          const workflowStepsB = await models.step.findAll({where:{workflowId:workflowB.id}});
          for(let workflowStepA of workflowStepsA) {
            if(workflowStepA.type=="load" || workflowStepA.type=="output") continue;
            for(let workflowStepB of workflowStepsB) {
              if(workflowStepB.type=="load" || workflowStepB.type=="output") continue;
              let existingCheckKey = workflowB.name+"_"+workflowB.id+"_"+workflowB.userName+"-"+workflowA.name+"_"+workflowA.id+"_"+workflowA.userName;
              if(Object.keys(overlap).includes(existingCheckKey) && overlap[existingCheckKey].filter(element=>element.includes(workflowStepB.name+"_"+workflowStepB.id)&&element.includes(workflowStepA.name+"_"+workflowStepA.id)).length) continue;
              if(this.isNegative(workflowStepA.name.split("---")[0].split("-").join(" "))!=this.isNegative(workflowStepB.name.split("---")[0].split("-").join(" "))) continue;
              //if(workflowStepA.name.split("---")[1]!=workflowStepB.name.split("---")[1]) continue;
              if(this.workflowStepAnalysis(workflowA, workflowStepA, workflowB, workflowStepB)) {
                overlap[key].push([workflowStepA.name+"_"+workflowStepA.id, workflowStepB.name+"_"+workflowStepB.id]);
              }
            }
          }
        }
      }
    }
    return overlap;
  }

  static async analyseSiblings() { 
    let workflows = await this.completeWorkflows("", 0, Number.MAX_VALUE);
    let overlap = await this.workflowOverlap(workflows);
    await fspromises.writeFile("siblings.json", JSON.stringify(overlap));
  }
  
  static async commonGeneralCondition(workflows) {
    let childParents = {};
    function getGeneralCondition(phrase) {
      let ignoreWords = ["medication", "other", "complications", "system", "unspecified"];
      if(!phrase.includes("-")) return phrase.toLowerCase();
      phrase = phrase.split(new RegExp('[-_]', 'g')).filter(word=>!Workflow.ignoreInStepName(word) && !ignoreWords.includes(word.toLowerCase()));
      if(phrase.length==1) return phrase[0].toLowerCase();
      let nlpd = nlp(phrase.join(" ").toLowerCase());
      let x = nlpd.nouns().json();
      if(nlpd.nouns().json().length) return nlpd.nouns().json()[0].terms[0].text;
      else if(nlpd.adjectives().json().length) return nlpd.adjectives().json()[nlpd.adjectives().json().length-1].terms[0].text;
    }
    function getGeneralConditions(phrase) {
      if(!Object.keys(childParents).includes(phrase)) childParents[phrase]=[];
      return childParents[phrase].concat([getGeneralCondition(phrase)]);
    }
    async function getSNOMEDParents(workflows) {
      console.log("Getting SNOMED parents...");
      for(let workflow of workflows) {
        let conceptSearch, parentSearch;
        try { conceptSearch = await got.get("http://"+config.get("validation.SNOWSTORM_URL")+"/MAIN/concepts?term="+workflow.name.replace("-", "+").replace("_", "+")).json(); } catch(error) { continue; };
        if(!conceptSearch.items[0]) continue;
        let parents=[], item=0;
        while(parents.length==0) {
          if(item>conceptSearch.items.length) break;
          try { parentSearch = await got.get("http://"+config.get("validation.SNOWSTORM_URL")+"/browser/MAIN/concepts/"+conceptSearch.items[item++].conceptId).json(); } catch(error) { break; };
          parents = parentSearch.relationships.filter(relationship=>relationship.type.pt.term=="Is a"&&relationship.characteristicType=="STATED_RELATIONSHIP").map(relationship=>relationship.target.pt.term);
        }
        childParents[workflow.name] = parents.map(term=>term.split(" ").filter(word=>!Workflow.ignoreInStepName(word)).join(" ")).filter(term=>term.length>0);
      }
      console.log("Done!");
    }
    await getSNOMEDParents(workflows);
    let conditions={}, iteration=1;
    for(let workflowA of workflows) {
      for(let workflowB of workflows) {
        console.log(Math.round((iteration++/(workflows.length*workflows.length))*100)+"%");
        let generalConditionsA = getGeneralConditions(workflowA.name);
        let generalConditionsB = getGeneralConditions(workflowB.name);
        let generalCondition = generalConditionsA.filter(condition=>generalConditionsB.includes(condition))[0];
        if(workflowA.id!=workflowB.id && generalCondition && !this.samePhenotype(workflowA.name, generalCondition) && !this.samePhenotype(workflowB.name, generalCondition) && !this.samePhenotype(workflowA.name, workflowB.name) && Workflow.isNegative(workflowA.name.split("-").join(" "))==Workflow.isNegative(workflowB.name.split("-").join(" "))) {
          generalCondition = generalCondition.toLowerCase();
          let workflowPair = [workflowA.name.toLowerCase()+"_"+workflowA.userName, workflowB.name.toLowerCase()+"_"+workflowB.userName];
          Object.keys(conditions).includes(generalCondition)?conditions[generalCondition]=conditions[generalCondition].concat(workflowPair):conditions[generalCondition]=workflowPair;
          conditions[generalCondition] = [...new Set(conditions[generalCondition])];
        }
      }
    }
    return conditions;
  }

  static async analyseHierarchical() { 
    let workflows = await this.completeWorkflows("", 0, Number.MAX_VALUE);
    console.log(workflows.map(workflow=>workflow.userName).reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map()));
    let conditions = await this.commonGeneralCondition(workflows);
    await fspromises.writeFile("hierarchical.json", JSON.stringify(conditions));
  }

}

module.exports = Workflow;
