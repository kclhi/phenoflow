const express = require("express");
const router = express.Router();
const logger = require("../config/winston");
const models = require("../models");
const config = require("config");
const got = require("got");
const sanitizeHtml = require('sanitize-html');
const jwt = require('express-jwt');
const Workflow = require("../util/workflow");
const Download = require("../util/download");

router.get("/all", async function(req, res, next) {

  let workflows = await Workflow.completeWorkflows();
  res.render("all",{title:"Phenoflow", workflows:workflows})

});

router.get("/all/:filter", async function(req, res, next) {

  let workflows = await Workflow.completeWorkflows(req.params.filter);
  res.render("all",{title:"Phenoflow", workflows:workflows})

});

router.get("/mine", async function(req, res, next) {

  let workflows = await models.workflow.findAll({where:{author:"martinchapman"}});
  res.render("mine",{title:"Phenoflow", workflows:workflows})

});

router.get("/define", (req, res, next)=>res.render("define",{title:"Phenoflow", languages:config.get("workflow.LANGUAGES"), concepts:config.get("workflow.CONCEPTS")}));

router.get("/define/:workflowId", async function(req, res, next) {

  try {
    res.render("define", {title:"Phenoflow", workflow:await Workflow.getWorkflow(req.params.workflowId), languages:config.get("workflow.LANGUAGES"), concepts:config.get("workflow.CONCEPTS")});
  } catch(error) {
    logger.error("Get workflow error: " + error);
    res.sendStatus(500);
  }

});

router.get("/download/:workflowId", async function(req, res, next) {

  try {
    res.render("download", {title:"Phenoflow", workflow:await Workflow.getWorkflow(req.params.workflowId)});
  } catch(error) {
    logger.error("Get workflow error: " + error);
    res.sendStatus(500);
  }

});

router.post("/new", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name || !req.body.author || !req.body.about) return res.sendStatus(500);
  try {
    let workflow = await models.workflow.create({name:sanitizeHtml(req.body.name), author:sanitizeHtml(req.body.author), about:sanitizeHtml(req.body.about)});
    res.send({"id":workflow.id});
  } catch(error) {
    error = "Error adding workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

router.post("/update/:id", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name || !req.body.author || !req.body.about) return res.sendStatus(500);
  try {
    await models.workflow.upsert({id:req.params.id, name: req.body.name, author: req.body.author, about: req.body.about});
    res.sendStatus(200);
  } catch(error) {
    error = "Error updating workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

async function generateWorkflow(workflowId, language=null, implementationUnits=null, res) {

  let workflow = await Workflow.getFullWorkflow(workflowId, language, implementationUnits);
  try {
    var generate = await got.post(config.get("generator.URL") + "/generate", {json:workflow.steps, responseType:"json"});
  } catch(error) {
    throw "Error contacting generator: " + error + " " + JSON.stringify(workflow.steps);
  }
  if (generate.statusCode==200 && generate.body && generate.body.workflow && generate.body.workflowInputs && generate.body.steps) {
    await Download.createPFZipResponse(res, workflowId, workflow.name, generate.body.workflow, generate.body.workflowInputs, language?language:implementationUnits, generate.body.steps, workflow.about);
  } else {
    throw "Error generating workflow.";
  }

}

router.get("/generate/:workflowId/:language", async function(req, res, next) {

  if(req.body.implementationUnits) return res.sendStatus(404);
  try {
    await generateWorkflow(req.params.workflowId, req.params.language, null, res);
    res.sendStatus(200);
  } catch(error) {
    logger.debug("Generate workflow error: " + error);
    res.sendStatus(500);
  }

});

router.post("/generate/:workflowId", async function(req, res, next) {

  if(!req.body.implementationUnits) return res.sendStatus(404);
  try {
    await generateWorkflow(req.params.workflowId, null, req.body.implementationUnits, res);
  } catch(error) {
    logger.debug("Error generating worflow: " + error);
    res.sendStatus(500);
  }

});

module.exports = router;
