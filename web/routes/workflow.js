const express = require("express");
const router = express.Router();
const logger = require("../config/winston");
const models = require("../models");
const config = require("config");
const got = require("got");
const bcrypt = require("bcrypt");
const sanitizeHtml = require('sanitize-html');
const jwt = require('express-jwt');
const { v1: uuidv1 } = require("uuid");

const Workflow = require("../util/workflow");
const Download = require("../util/download");

function credentialsCheck(user, req, res) {
  if(user&&user.restricted) {
    const b64auth = (req.headers.authorization||'').split(' ')[1]||'';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':')
    if(!login||!password||login!=user.name||!bcrypt.compare(password, user.password)) { 
      res.set('WWW-Authenticate', 'Basic realm="restricted"');
      res.status(401).send('Authentication required.');
      return false;
    }
  }
  return true;
}

/**
 * @swagger
 * /phenoflow/phenotype/all:
 *   post:
 *     summary: List phenotypes
 *     description: Retrieve a list of all phenotypes, or phenotypes matching the given criteria
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               importedId:
 *                 type: string
 *                 description: The ID grabbed from the import source. Often listed as a part of a definition's description.
 *                 example: XNIlg0YihF3u3iuI6IitMu0CNfQ
 *               name:
 *                 type: string
 *                 description: Phenotype name
 *                 example: Rheumatoid arthritis
 *     responses:
 *       200:
 *         description: A list of phenotypes
 */
router.post("/all", async function(req, res, next) {

  if(req.body.name) { 
    var workflowsByName = await Workflow.completeWorkflows(req.body.name, 0, Number.MAX_VALUE);
  } else {
    var workflowsByName = await Workflow.completeWorkflows("", 0, Number.MAX_VALUE);
  }
  if(req.body.importedId) var workflowsByImportedId = await Workflow.completeWorkflows(req.body.importedId, 0, limit=Number.MAX_VALUE);
  if(req.body.name&&workflowsByName&&req.body.importedId&&workflowsByImportedId) workflowsByName = workflowsByName.filter(workflowByName=>workflowsByImportedId.map(workflowByImportedId=>workflowByImportedId.id).includes(workflowByName.id));
  res.send(await Promise.all(workflowsByName.map(async (workflow) => {
    let user = await models.user.findOne({where:{name: workflow.userName}});
    return {"id":workflow.id, "name":workflow.name, "about":workflow.about, "user": user.name};
  })));

});

/**
 * @swagger
 * /phenoflow/phenotype/connectors:
 *   post:
 *     summary: Get connector IDs
 *     description: Retrieve a list of those phenotypes that only differ from the definition associated with the supplied ID by connector type
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the definition for which to find associated connectors (retrieved from a previous API call)
 *                 example: 5
 *     responses:
 *       200:
 *         description: A list of phenotypes
 */
router.post("/connectors", async function(req, res, next) {

  let children = await models.child.findAll({where:{parentId:req.body.id}});
  let connectors = children.map((child)=>({"id":child.workflowId, "connector":child.distinctStepName.replace("read-potential-cases-", "")}));
  connectors.push({"id":req.body.id, "connector":["fhir", "i2b2", "omop", "disc"].filter(connectorLabel=>!connectors.map(connector=>connector.connector).includes(connectorLabel))[0]});
  res.send(connectors);

});

router.post("/new", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name || !req.body.about || !req.body.userName) return res.sendStatus(500);
  if(!req.body.id) req.body.id = uuidv1();
  try {
    let workflow = await models.workflow.create({id:sanitizeHtml(req.body.id), name:sanitizeHtml(req.body.name), about:sanitizeHtml(req.body.about), userName:sanitizeHtml(req.body.userName)});
    res.send({"id":workflow.id});
  } catch(error) {
    error = "Error adding workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

router.post("/update/:id", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name||!req.body.about||!req.user.sub) return res.sendStatus(500);

  try {
    let workflow = await models.workflow.findOne({where:{id:req.params.id}});
    if(!(workflow.userName==req.user.sub)) return res.sendStatus(500);
    await models.workflow.upsert({id:req.params.id, name:req.body.name, about:req.body.about, userName:req.user.sub,});
    res.sendStatus(200);
  } catch(error) {
    error = "Error updating workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

async function generateWorkflow(workflowId, username, language=null, implementationUnits=null, res) {
  let workflow;
  try {
    workflow = await Workflow.getFullWorkflow(workflowId, username, language, implementationUnits);
    // handle nested steps
    workflow.steps = await Promise.all(workflow.steps.map(async (workflowStep)=>!workflowStep.implementation.fileName.includes(".")?Object.assign(workflowStep, {"implementation":await Workflow.getFullWorkflow(workflowStep.implementation.fileName, username, language, implementationUnits)}):workflowStep));
  } catch(getFullWorkflowError) {
    logger.error("Error getting full workflow: " + getFullWorkflowError);
  }
  try {
    var generate = await got.post(config.get("generator.URL") + "/generate", {json:workflow.steps, responseType:"json"});
  } catch(error) {
    logger.debug("Error contacting generator: "+error+" "+JSON.stringify(workflow.steps));
    return false;
  }
  implementationUnits = Object.assign({}, implementationUnits, ...workflow.steps.map(step=>step.implementation.steps).filter(step=>step!=undefined).flat().filter(step=>!Object.keys(implementationUnits).includes(step.name)).map((step)=>({[step.name]: step.implementation.language})));
  generate.body.steps = generate.body.steps.concat(generate.body.steps.map(step=>step.steps).filter(step=>step!=undefined)).flat();
  generate.body.steps = generate.body.steps.filter(({name}, index)=>!generate.body.steps.map(step=>step.name).includes(name, index+1));
  if(generate.statusCode==200&&generate.body&&generate.body.workflow&&generate.body.workflowInputs&&generate.body.steps) {
    return {"workflow":workflow, "generate":generate, "implementationUnits":implementationUnits};
  } else {
    logger.debug("Error generating workflow.");
    return false;
  }
}

async function createZip(workflowId, username, language=null, implementationUnits=null, res) {
  let generatedWorkflow;
  if(generatedWorkflow=await generateWorkflow(workflowId, username, language, implementationUnits, res)) {
    try {
      if(!await Download.createPFZipResponse(res, workflowId, generatedWorkflow.workflow.name, generatedWorkflow.generate.body.workflow, generatedWorkflow.generate.body.workflowInputs, language?language:generatedWorkflow.implementationUnits, generatedWorkflow.generate.body.steps, generatedWorkflow.workflow.about)) {
        logger.debug("Error generating workflow.");
        return false;
      }
    } catch(createPFZipResponseError) {
      logger.error("Error creating ZIP: " + createPFZipResponseError);
    }
    return true;
  } else {
    return false;
  }
}

/**
 * @swagger
 * /phenoflow/phenotype/generate/{phenotypeId}:
 *   post:
 *     summary: Generate a computable phenotype
 *     description: Generate a CWL workflow based on a phenotype definition
 *     parameters:
 *       - in: path
 *         name: phenotypeId
 *         required: true
 *         description: ID of the phenotype to generate
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userName:
 *                 type: string
 *                 description: Username of the owner of this definition
 *                 example: martinchapman
 *     responses:
 *       200:
 *         description: An executable workflow
 */
router.post("/generate/:workflowId", async function(req, res, next) {
  if(!req.body.userName) return res.sendStatus(401);
  let user = await models.user.findOne({where:{name: req.body.userName}});
  if(!credentialsCheck(user, req, res)) return;
  try {
    if (!await createZip(req.params.workflowId, req.body.userName, null, req.body.implementationUnits?req.body.implementationUnits:{}, res)) return res.sendStatus(500);
  } catch(error) {
    logger.debug("Error generating worflow: " + error);
    return res.sendStatus(500);
  }
});

async function createZenodoEntry(workflowId, user, language=null, implementationUnits=null, res) {
  let generatedWorkflow;
  if(generatedWorkflow=await generateWorkflow(workflowId, user.name, language, implementationUnits, res)) {
    let doi;
    try {
      if(!(doi=await Download.createPFZenodoEntry(workflowId, generatedWorkflow.workflow.name, generatedWorkflow.generate.body.workflow, generatedWorkflow.generate.body.workflowInputs, language?language:generatedWorkflow.implementationUnits, generatedWorkflow.generate.body.steps, generatedWorkflow.workflow.about, generatedWorkflow.workflow.userName, user.restricted))) {
        logger.debug("Error generating workflow.");
        return false;
      }
    } catch(createPFZenodoEntryError) {
      logger.error("Error uploading to Zenodo: "+createPFZenodoEntryError);
    }
    return doi;
  } else {
    return false;
  }
}

router.post("/cite/:workflowId", async function(req, res, next) {
  if(!req.body.implementationUnits) return res.sendStatus(404);
  if(!req.body.userName) return res.sendStatus(401);
  let user = await models.user.findOne({where:{name: req.body.userName}});
  try {
    let doi;
    if (!(doi=await createZenodoEntry(req.params.workflowId, user, null, req.body.implementationUnits, res))) return res.sendStatus(500);
    return res.send(doi).status(200);
  } catch(error) {
    logger.debug("Error citing worflow: " + error);
    return res.sendStatus(500);
  }
});

module.exports = router;
