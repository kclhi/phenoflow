const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sequelize = require('sequelize');
const op = sequelize.Op;
const jwt = require('express-jwt');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');
const got = require('got');
var FormData = require('form-data');
const { v1: uuidv1 } = require("uuid");

const config = require("config");
const ImporterUtils = require("../util/importer");
const Workflow = require('../util/workflow');
const Github = config.get('github.BASE_URL').includes('github') ? require('../util/github') : require('../util/gitea');
const { workflow } = require('../util/workflow');

/**
 * @swagger
 * /phenoflow/importer/importCodelists:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Import a set of codelists
 *     description: Create a phenotype definitions based upon a collection of codelists
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               csvs:
 *                 type: string
 *                 description: A zipped folder containing a collection of codelists as CSVs
 *                 format: binary
 *               name:
 *                 type: string
 *                 description: The name of the new definition
 *                 example: Diabetes
 *               about:
 *                 type: string
 *                 description: A description of the new definition
 *                 example: Diabetes phenotype developed at KCL
 *               userName:
 *                 type: string
 *                 description: the name of a pre-registered author to whom the definition should be attributed
 *                 example: martinchapman
 *     responses:
 *       200:
 *         description: Definition added.
 */
router.post('/importCodelists', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.body.name||!req.body.about||!req.body.userName) return res.status(500).send("Missing params.");
  let generatedWorkflows;
  if(req.files&&req.files.csvs) {
    try {
      const form = new FormData();
      form.append('csvs', req.files.csvs.data, 'csvs.zip');
      form.append('name', req.body.name);
      form.append('about', req.body.about);
      form.append('userName', req.body.userName);
      generatedWorkflows = await got.post(config.get('parser.URL')+'/phenoflow/parser/parseCodelists', {body:form, responseType:'json'});
      generatedWorkflows = generatedWorkflows.body;
    } catch(parseWorkflowError) {
      logger.error('Error parsing workflow: ' + parseWorkflowError);
      return res.sendStatus(500);
    }
  } else if(req.body.csvs) {
    try {
      generatedWorkflows = await got.post(config.get('parser.URL')+'/phenoflow/parser/parseCodelists', {json:{'csvs':req.body.csvs, 'name':req.body.name, 'about':req.body.about, 'userName':req.body.userName}, responseType:'json'});
      generatedWorkflows = generatedWorkflows.body;
    } catch(parseWorkflowError) {
      logger.error('Error parsing workflow: ' + parseWorkflowError);
      return res.sendStatus(500);
    }
  }
  try {
    let parent;
    for(let workflow of generatedWorkflows) {
      if(!(workflow.id=await Importer.importPhenotype(workflow.id, workflow.name, workflow.about, workflow.userName, workflow.steps))) continue;
      if(workflow.steps[0].stepType=="load"||workflow.steps[0].stepType=="external") {
        try {
          let child = await models.workflow.findOne({where:{id:workflow.id}});
          let hasParent = await child.getParent();
          if(!parent) {
            parent = await models.workflow.findOne({where:{id:workflow.id}});
          } else if(parent && !hasParent.length) {
            await child.addParent(parent, {through:{name:parent.name, distinctStepName:workflow.steps[0].stepName, distinctStepPosition:0}});
          }
        } catch(setParentError) {
          logger.error('Error setting parent: ' + setParentError);
          return res.sendStatus(500);
        }
      }
      let restricted = false;
      try {
        let user = await models.user.findOne({where:{name:req.body.userName}});
        restricted = user.restricted;
      } catch(getUserError) {
        logger.error('Error getting user restricted status: ' + getUserError);
      }
      await Github.generateAndCommit(workflow.id, workflow.name, workflow.about, workflow.steps[0].stepName, req.body.userName, restricted);
    }
    return res.sendStatus(200);
  } catch(importListsError) {
    logger.error('Error importing list: ' + importListsError);
    return res.sendStatus(500);
  }
});

/**
 * @swagger
 * /phenoflow/importer/importKeywordList:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Import a list of keywords
 *     description: Create a phenotype definitions based upon a list of keywords
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               keywords:
 *                 type: string
 *                 description: A CSV file listing keywords
 *                 format: binary
 *               name:
 *                 type: string
 *                 description: The name of the new definition
 *                 example: Diabetes
 *               about:
 *                 type: string
 *                 description: A description of the new definition
 *                 example: Diabetes phenotype developed at KCL
 *               userName:
 *                 type: string
 *                 description: the name of a pre-registered author to whom the definition should be attributed
 *                 example: martinchapman
 *     responses:
 *       200:
 *         description: Definition added
 */
router.post('/importKeywordList', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.body.keywords||!req.body.name||!req.body.about||!req.body.userName) return res.status(500).send("Missing params.");
  let generatedWorkflows;
  if(req.files&&req.files.keywords) {
    try {
      const form = new FormData();
      form.append('keywords', req.files.keywords.data, 'keywords.zip');
      form.append('name', req.body.name);
      form.append('about', req.body.about);
      form.append('userName', req.body.userName);
      generatedWorkflows = await got.post(config.get('parser.URL')+'/phenoflow/parser/parseKeywordList', {body:form, responseType:'json'});
      generatedWorkflows = generatedWorkflows.body;
    } catch(parseWorkflowError) {
      logger.error('Error parsing workflow: ' + parseWorkflowError);
      return res.sendStatus(500);
    }
  } else if(req.body.keywords) {
    try {
      generatedWorkflows = await got.post(config.get('parser.URL')+'/phenoflow/parser/parseKeywordList', {json:{'keywords':req.body.keywords, 'name':req.body.name, 'about':req.body.about, 'userName':req.body.userName}, responseType:'json'});
      generatedWorkflows = generatedWorkflows.body;
    } catch(parseWorkflowError) {
      logger.error('Error parsing workflow: ' + parseWorkflowError);
      return res.sendStatus(500);
    }
  }
  try {
    let parent;
    for(let workflow of generatedWorkflows) {
      if(!(workflow.id=await Importer.importPhenotype(workflow.id, workflow.name, workflow.about, workflow.userName, workflow.steps))) continue;
      if(workflow.steps[0].stepType=="load"||workflow.steps[0].stepType=="external") {
        try {
          let child = await models.workflow.findOne({where:{id:workflow.id}});
          let hasParent = await child.getParent();
          if(!parent) {
            parent = await models.workflow.findOne({where:{id:workflow.id}});
          } else if(parent && !hasParent.length) {
            await child.addParent(parent, {through:{name:parent.name, distinctStepName:workflow.steps[0].stepName, distinctStepPosition:0}});
          }
        } catch(setParentError) {
          logger.error('Error setting parent: ' + setParentError);
          return res.sendStatus(500);
        }
      }
      let restricted = false;
      try {
        let user = await models.user.findOne({where:{name:req.body.userName}});
        restricted = user.restricted;
      } catch(getUserError) {
        logger.error('Error getting user restricted status: ' + getUserError);
      }
      await Github.generateAndCommit(workflow.id, workflow.name, workflow.about, workflow.steps[0].stepName, req.body.userName, restricted);
    }
    return res.sendStatus(200);
  } catch(importListsError) {
    logger.error('Error importing list: ' + importListsError);
    return res.sendStatus(500);
  }
});

/**
 * @swagger
 * /phenoflow/importer/importSteplist:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Import a steplist
 *     description: Create a phenotype definitions based upon a list of steps
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               steplist:
 *                 type: string
 *                 description: The list of steps, as a file formatted according to the Phenoflow import standard
 *                 format: binary
 *               csvs:
 *                 type: string
 *                 description: A zipped folder containing a collection of the CSVs referenced in the steplist, including branches (and their CSVs)
 *                 format: binary
 *               name:
 *                 type: string
 *                 description: The name of the new definition
 *                 example: Diabetes
 *               about:
 *                 type: string
 *                 description: A description of the new definition
 *                 example: Diabetes phenotype developed at KCL
 *               userName:
 *                 type: string
 *                 description: the name of a pre-registered author to whom the definition should be attributed
 *                 example: martinchapman
 *     responses:
 *       200:
 *         description: Definition added
 */
router.post('/importSteplist', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.body.steplist||!req.body.name||!req.body.about||!req.body.userName||!req.body.csvs) return res.status(500).send("Missing params.");
  let generatedWorkflows;
  if(req.files&&req.files.steplist&&req.files.csvs) {
    try {
      const form = new FormData();
      form.append('steplist', req.files.steplist.data, 'steplist.csv');
      form.append('csvs', req.files.csvs.data, 'csvs.zip');
      form.append('name', req.body.name);
      form.append('about', req.body.about);
      form.append('userName', req.body.userName);
      generatedWorkflows = await got.post(config.get('parser.URL')+'/phenoflow/parser/parseSteplist', {body:form, responseType:'json'});
      generatedWorkflows = generatedWorkflows.body;
    } catch(parseWorkflowError) {
      logger.error('Error parsing workflow: ' + parseWorkflowError);
      return res.sendStatus(500);
    }
  } else if(req.body.steplist&&req.body.csvs) {
    try {
      generatedWorkflows = await got.post(config.get('parser.URL')+'/phenoflow/parser/parseSteplist', {json:{'steplist':req.body.steplist, 'csvs':req.body.csvs, 'name':req.body.name, 'about':req.body.about, 'userName':req.body.userName}, responseType:'json'});
      generatedWorkflows = generatedWorkflows.body;
    } catch(parseWorkflowError) {
      logger.error('Error parsing workflow: ' + parseWorkflowError);
      return res.sendStatus(500);
    }
  }
  try {
    let importedWorkflows = [], parent;
    for(let workflow of generatedWorkflows) {
      if(!(workflow.id=await Importer.importPhenotype(workflow.id, workflow.name, workflow.about, workflow.userName, workflow.steps))) continue;
      importedWorkflows.push(workflow);
      if(workflow.steps[0].stepType!="load"&&workflow.steps[0].stepType!="external") continue;
      try {
        let child = await models.workflow.findOne({where:{id:workflow.id}});
        let hasParent = await child.getParent();
        if(!parent) {
          parent = await models.workflow.findOne({where:{id:workflow.id}});
        } else if(parent && !hasParent.length) {
          await child.addParent(parent, {through:{name:parent.name, distinctStepName:workflow.steps[0].stepName, distinctStepPosition:0}});
        }
      } catch(setParentError) {
        logger.error('Error setting parent: ' + setParentError);
        return res.sendStatus(500);
      }
    }
    let restricted = false;
    try {
      let user = await models.user.findOne({where:{name:req.body.userName}});
      restricted = user.restricted;
    } catch(getUserError) {
      logger.error('Error getting user restricted status: ' + getUserError);
    }
    await Github.generateAndCommitAll(importedWorkflows, restricted);
    return res.sendStatus(200);
  } catch(importListsError) {
    logger.error('Error importing list: ' + importListsError);
    return res.sendStatus(500);
  }
});

/**
 * @swagger
 * /phenoflow/importer/addConnector:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add a new connector
 *     description: Add a new connector to an existing phenotype definition
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               implementationTemplate:
 *                 type: string
 *                 format: binary
 *               existingWorkflowIds:
 *                 type: array
 *                 description: The IDs of the workflows to which to add the new connector (single values also accepted for individual workflows)
 *                 example: [1, 2]
 *               dataSource:
 *                 type: string
 *                 description: A description of the data source targeted by the connector
 *                 example: FHIR
 *               language:
 *                 type: string
 *                 description: The language in which the connector has been developed
 *                 example: python, js or KNIME
 *     responses:
 *       200:
 *         description: Connector added
 */
router.post('/addConnector', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.files.implementationTemplate||!req.body.existingWorkflowIds||!req.body.dataSource||!req.body.language) res.status(500).send("Missing params.");
  if(req.body.language&&!config.get("workflow.LANGUAGES").includes(req.body.language)) res.send("Supported language are: "+config.get("workflow.LANGUAGES").join(" ")).status(500);
  const OUTPUT_EXTENSION = "csv";
  if(!Array.isArray(req.body.existingWorkflowIds)) req.body.existingWorkflowIds = [req.body.existingWorkflowIds];
  for(let existingWorkflowId of req.body.existingWorkflowIds) {
    let existingWorkflow = await Workflow.workflow(await Workflow.getWorkflow(existingWorkflowId));
    for(let step of existingWorkflow.steps) {
      step.stepName = step.name;
      step.stepDoc = step.doc;
      step.stepType = step.type;
      step.inputDoc = step.inputs[0].doc;
      step.outputDoc = step.outputs[0].doc;
      step.outputExtension = step.outputs[0].extension;
      for(let implementation in step.implementations) {
        if(!step.implementations[implementation].fileName.includes(".")) continue;
        const source = "uploads/"+existingWorkflow.id+"/"+step.implementations[implementation].language;
        let sourceFile;
        try {
          let path = source+"/"+step.implementations[implementation].fileName.replace(/\//g, "");
          sourceFile = await fs.readFile(path, "utf8");
        } catch(error) {
          logger.error('Unable to read file: ' + error + ' ' + path);
          res.sendStatus(500);
        }
        step.implementations[implementation].implementationTemplate = sourceFile;
      }
    }
    let implementationTemplate = req.files.implementationTemplate;
    try {
      existingWorkflow.steps[0] = await got.post(config.get('parser.URL')+'/phenoflow/parser/parseStep', {json:{"name":"read-potential-cases-"+ImporterUtils.clean(req.body.dataSource), "doc":"Read potential cases from "+req.body.dataSource, "type":"external", "position":1, "inputDoc":existingWorkflow.steps[0].inputDoc, "outputDoc":"Initial potential cases, read from "+req.body.dataSource, "outputExtensions":OUTPUT_EXTENSION, "implementations":[{"fileName":implementationTemplate.name, "language":req.body.language, "implementationTemplate":implementationTemplate.data.toString(), "substitutions":{"PHENOTYPE":ImporterUtils.clean(existingWorkflow.name.toLowerCase())}}]}, responseType:'json'});
      existingWorkflow.steps[0] = existingWorkflow.steps[0].body;
    } catch(parseStepError) {
      logger.error('Error parsing step: ' + parseStepError);
      return res.sendStatus(500);
    }
    
    let duplicatedWorkflowId = await Importer.createWorkflow(req.body.newWorkflowId?req.body.newWorkflowId:uuidv1(), existingWorkflow.name, existingWorkflow.about, existingWorkflow.userName);
    existingWorkflow.steps = existingWorkflow.steps.map(({workflowId, ...step}) => ({...step, workflowId:duplicatedWorkflowId}));
    await Importer.createSteps(duplicatedWorkflowId, existingWorkflow.steps);
    await Workflow.workflowComplete(duplicatedWorkflowId);
    try {
      let parent = await models.workflow.findOne({where:{id:existingWorkflowId}});
      let child = await models.workflow.findOne({where:{id:duplicatedWorkflowId}});
      await child.addParent(parent, {through:{name:parent.name, distinctStepName:existingWorkflow.steps[0].stepName, distinctStepPosition:0}});
    } catch(setParentError) {
      logger.error('Error setting parent: ' + setParentError);
      return res.sendStatus(500);
    }
    let restricted = false;
    try {
      let user = await models.user.findOne({where:{name:existingWorkflow.userName}});
      restricted = user.restricted;
    } catch(getUserError) {
      logger.error('Error getting user restricted status: ' + getUserError);
    }
    await Github.generateAndCommit(duplicatedWorkflowId, existingWorkflow.name, existingWorkflow.about, existingWorkflow.steps[0].stepName, existingWorkflow.userName, restricted);
  }
  res.sendStatus(200);
});

router.post('/remove', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.body.id) res.status(500).send("Missing params.");
  if(!await Importer.removeWorkflows(req.body.id)) return res.sendStatus(500);
  res.sendStatus(200);
});

router.post('/cleanup', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!await Importer.removePartialImports()) return res.sendStatus(500);
  res.sendStatus(200);
});

//

class Importer {

  static async importPhenotype(generatedWorkflowId, name, about, userName, steps) {
    let existingWorkflowId = await Importer.existingWorkflow(name, about, userName, steps[0].stepType=="load"||steps[0].stepType=="external"?steps[0].stepName:null);
    let workflowId;
    try {
      workflowId = (existingWorkflowId||await Importer.createWorkflow(generatedWorkflowId, name, about, userName));
    } catch(createWorkflowError) {
      logger.error('Error creating workflow: ' + createWorkflowError);
      return null;
    }
    let existingWorkflowChanged = await Importer.importChangesExistingWorkflow(existingWorkflowId, steps);
    if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) { 
      if(existingWorkflowChanged) if(!await Workflow.deleteStepsFromWorkflow(existingWorkflowId)) return false;
      try {
        await Importer.createSteps(workflowId, steps);
      } catch(createStepsError) {
        logger.error('Error creating steps: ' + createStepsError);
        return null;
      }
      await Workflow.workflowComplete(workflowId);
      return workflowId;
    }
    return null;
  }

  static async importChangesExistingWorkflow(workflowId, steps) {
    if(!workflowId||!steps) return false;
    let existingSteps = await models.step.findAll({where:{workflowId:workflowId}});
    if(existingSteps.length!=steps.length) return true;
    steps = steps.sort((a, b)=>a.position-b.position);
    existingSteps = existingSteps.sort((a, b)=>a.position-b.position);
    for(let step in steps) {
      if(steps[step].stepName!=existingSteps[step].name) return true;
      if(steps[step].stepDoc!=existingSteps[step].doc) return true;
      if(steps[step].stepType!=existingSteps[step].type) return true;
      let existingInput = await models.input.findOne({where:{stepId:existingSteps[step].id}});
      let existingOutput = await models.output.findOne({where:{stepId:existingSteps[step].id}});
      let existingImplementations = await models.implementation.findAll({where:{stepId:existingSteps[step].id}});
      if(steps[step].inputDoc!=existingInput.doc) return true;
      if(steps[step].outputDoc!=existingOutput.doc) return true;
      if(steps[step].outputExtension!=existingOutput.extension) return true;
      for(let implementation of steps[step].implementations) {
        if(!implementation.fileName.includes(".")) continue;
        let matchingImplementation = existingImplementations.find(existingImplementation=>existingImplementation.fileName==implementation.fileName);
        if(!matchingImplementation) return true;
        if(implementation.language!=matchingImplementation.language) return true;
        const destination = "uploads/" + workflowId + "/" + matchingImplementation.language;
        let storedImplementation = await fs.readFile(destination+"/"+matchingImplementation.fileName, "utf8");
        if(implementation.implementationTemplate!=storedImplementation) return true;
      }
    }
    return false;
  }

  static async existingWorkflow(name, about, userName, connectorStepName="") {
    try {
      let workflows = await models.workflow.findAll({where: {name:name, about:about, userName:sanitizeHtml(userName)}});
      if(workflows.length==1&&!connectorStepName) return workflows[0].id;
      if(workflows.length) {
        if(workflows.length>4) throw "More than one match when checking for existing workflows.";
        for(let workflow of workflows) {
          try {
            let steps = await models.step.findAll({where:{workflowId:workflow.id}});
            if(!connectorStepName||steps.map((step)=>step.name).includes(connectorStepName)) {
              return workflow.id;
            }
          } catch(error) {
            logger.error('Unable to check for existing steps: ' + error);
          }
        }
      }
    } catch(error) {
      logger.error('Unable to check for existing workflow: ' + error);
    }
    return false;
  }

  static async createSteps(workflowId, steps) {

    let step;
    if(steps.map(step=>step.stepName).length!=new Set(steps.map(step=>step.stepName)).size) throw "Duplicate steps found during import: " + JSON.stringify(steps.map(step=>step.stepName));

    for(let stepData of steps) {
      try {
        step = await models.step.create({name:stepData.stepName, doc:stepData.stepDoc, type:stepData.stepType, workflowId:workflowId, position:stepData.position});
      } catch(error) {
        error = "Error importing step: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        throw error;
      }
    
      try {
        await models.input.create({doc:stepData.inputDoc, stepId:step.id});
      } catch(error) {
        error = "Error importing step input: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        throw error;
      }
    
      try {
        await models.output.create({doc:stepData.outputDoc, extension:stepData.outputExtension, stepId:step.id});
      } catch(error) {
        error = "Error importing step output: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        throw error;
      }
      
      for(let implementation of stepData.implementations) {
        try {
          await models.implementation.upsert({fileName:implementation.fileName, language:implementation.language, stepId:step.id});
        } catch(error) {
          error = "Error creating step implementation: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
          logger.debug(error);
          throw error;
        }
        
        if(implementation.language&&implementation.implementationTemplate) {
          const destination = "uploads/" + workflowId + "/" + implementation.language;
        
          try {
            await fs.stat(destination);
          } catch(error) {
            await fs.mkdir(destination, {recursive:true});
          }
          fs.writeFile(destination + "/" + implementation.fileName.replace(/\//g, ""), implementation.implementationTemplate);
        }
      }
    }

  }

  static async createWorkflow(workflowId, name, about, userName) {
    try {
      var workflow = await models.workflow.create({id:workflowId, name:name, about:about, userName:sanitizeHtml(userName)});
      return workflow.id;
    } catch(error) {
      error = "Error creating workflow for CSV: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      return false;
    }
  }

  static async removeWorkflow(workflowId) {
    if(!workflowId) return false;
    if(!await Workflow.deleteStepsFromWorkflow(workflowId)) return false;
    try {
      await models.workflow.destroy({where:{id:workflowId}});
    } catch(error) {
      logger.error('Error deleting workflow: ' + error);
      return false;
    }
    try {
      await fs.rm("output/"+workflowId, {recursive:true});
    } catch(error) {
      logger.error('Error removing local repo for ' + workflowId + ': ' + error);
      return false;
    }
    if(!await Github.deleteRepo(workflowId)) return false;
    return true;
  }

  static async removeWorkflows(workflowId) {
    // if child
    try {
      let child = await models.child.findOne({where:{workflowId:workflowId}});
      if(child) {
        try {
          for(let sibling of (await models.child.findAll({where:{parentId:child.parentId}}))) {
            if(sibling.workflowId == child.workflowId) continue;
            await Importer.removeWorkflow(sibling.workflowId);
          } 
        } catch(error) {
          console.error("Error removing sibling workflow(s): "+error);
          return false;
        }
        await Importer.removeWorkflow(child.parentId);
      }
    } catch(error) {
      console.error("Error removing parent workflow: "+error);
      return false;
    }
    // if parent
    try {
      for(let child of (await models.child.findAll({where:{parentId:workflowId}}))) {
        await Importer.removeWorkflow(child.workflowId);
      } 
    } catch(error) {
      console.error("Error removing child workflow(s): "+error);
      return false;
    }

    await Importer.removeWorkflow(workflowId);
    return true;
  }

  static async removePartialImports() {
    for(let repo of (await Github.getRepos())?.data || []) {
      try {
        if((await Github.getBranches(repo.name)).data.length < config.get("github.EXPECTED_BRANCH_COUNT")) {
          if(repo.name.includes("---") && !await Importer.removeWorkflows(repo.name.slice(repo.name.lastIndexOf("---") + 3, repo.name.length))) return false;
        }
      } catch(error) {
        logger.error('Unable to get branches: ' + error);
        return false;
      }
    }
    return true;
  }

}

//

router.post('/caliber/annotate', async function(req, res, next) {

  if(!req.body.markdown||!req.body.name||!req.body.about) {
    logger.debug("Missing params.");
    return res.status(500).send("Missing params.");
  }

  try {
    var phenotypes = await models.workflow.findAll({where:{complete:true, name:{[op.like]:"%"+req.body.name+"%"}, about:{[op.like]:"%"+req.body.about+"%"}, [op.and]:[{'$parent.child.workflowId$':null}, {'$parent.child.parentId$':null}]}, include:[{model:models.workflow, as:"parent", required:false}], order:[['name', 'ASC']]})
  } catch(error) {
    logger.error(error.message);
  }
  let markdowns = [];

  if(!phenotypes) res.sendStatus(500);
  
  for(let phenotype of phenotypes) {

    var lastHeading="";
    let updatedContent="";
    const BUTTON_HTML = '<button type="button" class="btn btn-sm"><a href="https://kclhi.org/phenoflow/phenotype/download/'+phenotype.id+'">Phenoflow implementation</a></button>\n';

    for(let line of req.body.markdown.content.split("\n")) {
      if(lastHeading.includes("Implementation")&&line.startsWith("#")) updatedContent += BUTTON_HTML;
      if(line.startsWith("#")) lastHeading=line;
      updatedContent+=line+"\n";
    }

    req.body.markdown.content = updatedContent.substring(1, updatedContent.length-1);
    // Markdown output
    let markdown = "";
    markdown+="---\n";

    for(let [key, value] of Object.entries(req.body.markdown)) {
      if(!value) continue;
      if(key=="content") {
        markdown+="---\n";
        markdown+=value?value:"";
        break;
      }
      if(Array.isArray(value)) {
        markdown+=key+": \n";
        for(let markdownArrayItem of value) markdown+="    - "+(key=="publications"?"'":"")+markdownArrayItem+(key=="publications"?"' ":"")+"\n";
      } else {
        if(key.includes("date")&&value.includes("T")) value=value.split("T")[0]
        markdown+=key+": "+(value?value+(key=="phenotype_id"?" ":""):"")+"\n";
      }
    }

    if(!markdown.includes("phenoflow")) {
      if(!lastHeading.includes("Implementation")) {
        markdown += "\n" + "### Implementation" + "\n" + BUTTON_HTML;
      } else {
        markdown += "\n" + BUTTON_HTML;
      }
    } 
    markdowns.push(markdown);
  }

  res.send({"markdowns":markdowns});
});

module.exports = router;
