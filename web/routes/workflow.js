const express = require("express");
const router = express.Router();
const logger = require("../config/winston");
const models = require("../models");
const config = require("config");
const got = require("got");
const bcrypt = require("bcrypt");
const sanitizeHtml = require('sanitize-html');
const jwt = require('express-jwt');

const Workflow = require("../util/workflow");
const Download = require("../util/download");
const ImporterUtils = require("../util/importer");

function processOffset(offsetParam) {

  try {
    var offset = offsetParam?parseInt(sanitizeHtml(offsetParam)):0;
    if (isNaN(offset)) throw Error("Param is not a number.");
    return offset;
  } catch(error) {
    logger.debug("Error getting offset: " + error);
    return false;
  }

}

router.get("/all/:offset?", async function(req, res, next) {

  let offset = processOffset(req.params.offset);
  if(offset===false) return next();
  let workflows = await Workflow.completeWorkflows("", offset);
  res.render("all",{title:"Library", workflows:workflows, listPrefix:"/phenoflow/phenotype/download/", limit:config.get("ui.PAGE_LIMIT"), previous:offset-config.get("ui.PAGE_LIMIT"), next:offset+config.get("ui.PAGE_LIMIT")})

});

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

router.get("/all/:filter/:offset?", async function(req, res, next) {

  let offset = processOffset(req.params.offset);
  if(offset===false) return res.sendStatus(404);
  let user = await models.user.findOne({where:{name:req.params.filter}});
  if(!credentialsCheck(user, req, res)) return;
  let workflows = (user&&user.restricted)?await Workflow.restrictedWorkflows(req.params.filter, offset):await Workflow.completeWorkflows(req.params.filter, offset);
  res.render("all", {title:"Library of '" + req.params.filter + "' phenotypes", workflows:workflows, listPrefix:"/phenoflow/phenotype/download/", limit:config.get("ui.PAGE_LIMIT"), previous:offset-config.get("ui.PAGE_LIMIT"), next:offset+config.get("ui.PAGE_LIMIT")})

});

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
    return {"id":workflow.id, "name":workflow.name, "about":workflow.about, "url":"https://kclhi.org/phenoflow/phenotype/download/"+workflow.id, "user": user.name};
  })));

});

router.get("/mine/:offset?", async function(req, res, next) {

  let offset = processOffset(req.params.offset);
  if(offset===false) return res.sendStatus(404);
  var workflows = await models.workflow.findAll({order: [['name', 'ASC']]});
  res.render("mine",{title:"My library", workflows:workflows, listPrefix:"/phenoflow/phenotype/define/", limit:config.get("ui.PAGE_LIMIT")})

});

router.get("/define", (req, res, next)=>res.render("define",{title:"Phenotype", languages:config.get("workflow.LANGUAGES"), concepts:config.get("workflow.CONCEPTS")}));

router.get("/define/:workflowId", async function(req, res, next) {

  try {
    res.render("define", {title:"Phenotype", workflow:await Workflow.getWorkflow(req.params.workflowId), languages:config.get("workflow.LANGUAGES"), concepts:config.get("workflow.CONCEPTS")});
  } catch(error) {
    logger.error("Get workflow error: " + error);
    res.sendStatus(500);
  }

});

router.get("/download", async function(req, res, next) {

  try {
    let workflow = await Workflow.getRandomWorkflow();
    if(!workflow) return res.redirect("/phenoflow");
    let user = await models.user.findOne({where:{name: workflow.userName}});
    res.render("download", {title:"'" + workflow.name + "' phenotype", workflow:workflow, userName:user.name, verified:user.verified});
  } catch(error) {
    logger.error("Get workflow error: " + error);
    res.sendStatus(500);
  }

});

router.get("/download/:workflowId/:zenodo?", async function(req, res, next) {

  try {
    let workflowId = req.params.workflowId;
    if(req.params.zenodo) workflowId = (await models.doi.findOne({where:{doi:req.params.workflowId+"/"+req.params.zenodo}})).workflowId;
    let workflow = await Workflow.getWorkflow(workflowId);
    workflow = await Workflow.addChildrenToStep(workflow);
    if(!workflow) res.sendStatus(500);
    let user = await models.user.findOne({where:{name: workflow.userName}});
    if(!credentialsCheck(user, req, res)) return;
    res.render("download", {title:"'" + workflow.name + "' phenotype"+(req.query.parent?" branch":""), workflow:workflow, userName:user.name, verified:user.verified, homepage:user.homepage, download:"DOWNLOAD "+(req.query.parent?"FULL DEFINITION":""), doi:((user&&!user.restricted)&&req.params.zenodo?req.params.workflowId+"/"+req.params.zenodo:""), restricted:user?user.restricted:""});
  } catch(error) {
    logger.error("Get workflow error: " + error);
    res.sendStatus(500);
  }

});

router.post("/new", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name || !req.body.about || !req.body.userName) return res.sendStatus(500);
  try {
    let workflow = await models.workflow.create({name:sanitizeHtml(req.body.name), about:sanitizeHtml(req.body.about), userName:sanitizeHtml(req.body.userName)});
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

async function generateWorkflow(workflowId, language=null, implementationUnits=null, res) {
  let workflow;
  try {
    workflow = await Workflow.getFullWorkflow(workflowId, language, implementationUnits);
    workflow.steps = await Promise.all(workflow.steps.map(async (workflowStep)=>!workflowStep.implementation.fileName.includes(".")?Object.assign(workflowStep, {"implementation":await Workflow.getFullWorkflow(workflowStep.implementation.fileName, language, implementationUnits)}):workflowStep));
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

async function createZip(workflowId, language=null, implementationUnits=null, res) {
  let generatedWorkflow;
  if(generatedWorkflow=await generateWorkflow(workflowId, language, implementationUnits, res)) {
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
 *     responses:
 *       200:
 *         description: An executable workflow
 */
router.post("/generate/:workflowId", async function(req, res, next) {
  if(!req.body.userName) return res.sendStatus(500);
  let user = await models.user.findOne({where:{name: req.body.userName}});
  if(!credentialsCheck(user, req, res)) return;
  try {
    if (!await createZip(req.params.workflowId, null, req.body.implementationUnits?req.body.implementationUnits:{}, res)) return res.sendStatus(500);
  } catch(error) {
    logger.debug("Error generating worflow: " + error);
    return res.sendStatus(500);
  }
});

async function createZenodoEntry(workflowId, language=null, implementationUnits=null, res) {
  let generatedWorkflow;
  if(generatedWorkflow=await generateWorkflow(workflowId, language, implementationUnits, res)) {
    let doi;
    try {
      if(!(doi=await Download.createPFZenodoEntry(workflowId, generatedWorkflow.workflow.name, generatedWorkflow.generate.body.workflow, generatedWorkflow.generate.body.workflowInputs, language?language:generatedWorkflow.implementationUnits, generatedWorkflow.generate.body.steps, generatedWorkflow.workflow.about, generatedWorkflow.workflow.userName))) {
        logger.debug("Error generating workflow.");
        return false;
      }
    } catch(createPFZenodoEntry) {
      logger.error("Error uploading to Zenodo: "+createPFZenodoEntry);
    }
    return doi;
  } else {
    return false;
  }
}

router.post("/cite/:workflowId", async function(req, res, next) {
  if(!req.body.implementationUnits) return res.sendStatus(404);
  if(!req.body.userName) return res.sendStatus(500);
  let user = await models.user.findOne({where:{name: req.body.userName}});
  if(user&&user.restricted) return res.sendStatus(405);
  let doi = await models.doi.findOne({where:{workflowId:req.params.workflowId, implementationHash:ImporterUtils.hash(req.body.implementationUnits)}});
  if(doi) return res.send(doi.doi).status(200);
  try {
    let doi;
    if (!(doi=await createZenodoEntry(req.params.workflowId, null, req.body.implementationUnits, res))) return res.sendStatus(500);
    return res.send(doi).status(200);
  } catch(error) {
    logger.debug("Error citing worflow: " + error);
    return res.sendStatus(500);
  }
});

module.exports = router;
