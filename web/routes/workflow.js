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

router.get("/download/:workflowId", async function(req, res, next) {

  try {
    let workflow = await Workflow.getWorkflow(req.params.workflowId);
    workflow = await Workflow.addChildrenToStep(workflow);
    if(!workflow) res.sendStatus(500);
    let user = await models.user.findOne({where:{name: workflow.userName}});
    if(!credentialsCheck(user, req, res)) return;
    res.render("download", {title:"'" + workflow.name + "' phenotype", workflow:workflow, userName:user.name, verified:user.verified, homepage:user.homepage});
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
    workflow.steps = await Promise.all(workflow.steps.map(async (workflowStep)=>!workflowStep.implementation.fileName.includes(".")?Object.assign(workflowStep, {"implementation":await Workflow.getFullWorkflow(workflowStep.implementation.fileName)}):workflowStep));
  } catch(getFullWorkflowError) {
    logger.error("Error getting full workflow: " + getFullWorkflowError);
  }
  try {
    var generate = await got.post(config.get("generator.URL") + "/generate", {json:workflow.steps, responseType:"json"});
  } catch(error) {
    logger.debug("Error contacting generator: " + error + " " + JSON.stringify(workflow.steps));
    return false;
  }
  implementationUnits = Object.assign({}, implementationUnits, ...workflow.steps.map(step=>step.implementation.steps).filter(step=>step!=undefined).flat().map((step) => ({[step.name]: step.implementation.language})));
  generate.body.steps = generate.body.steps.concat(generate.body.steps.map(step=>step.steps).filter(step=>step!=undefined)).flat();
  if(generate.statusCode==200&&generate.body&&generate.body.workflow&&generate.body.workflowInputs&&generate.body.steps) {
    try {
      if(!await Download.createPFZipResponse(res, workflowId, workflow.name, generate.body.workflow, generate.body.workflowInputs, language?language:implementationUnits, generate.body.steps, workflow.about)) {
        logger.debug("Error generating workflow.");
        return false;
      }
    } catch(createPFZipResponseError) {
      logger.error("Error creating ZIP: " + createPFZipResponseError);
    }
  } else {
    logger.debug("Error generating workflow.");
    return false;
  }
  return true;

}

router.post("/generate/:workflowId", async function(req, res, next) {

  if(!req.body.implementationUnits) return res.sendStatus(404);
  if(!req.body.userName) return res.sendStatus(500);
  let user = await models.user.findOne({where:{name: req.body.userName}});
  if(!credentialsCheck(user, req, res)) return;
  try {
    if (!await generateWorkflow(req.params.workflowId, null, req.body.implementationUnits, res)) return res.sendStatus(500);
  } catch(error) {
    logger.debug("Error generating worflow: " + error);
    return res.sendStatus(500);
  }

});

module.exports = router;
