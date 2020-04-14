const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const config = require('config');
const got = require('got');

const Utils = require('../util/utils');

router.get('/define', (req, res, next)=>res.render('define',{title:'Phenoflow'}));

async function getWorkflow(workflowId, language=null, implementationUnits=null) {

  let partial = language==null && implementationUnits==null;
  try {
    var workflow = JSON.parse(JSON.stringify(await models.workflow.findOne({where:{id:workflowId}})));
    if (!workflow) throw "Error finding workflow";
    let steps = await models.step.findAll({where:{workflowId:workflow.id}});
    if (!partial && !steps) throw "Error finding steps";
    let mergedSteps = [];
    for (const step in steps) {
      let mergedStep = JSON.parse(JSON.stringify(steps[step]));
      mergedStep.inputs = JSON.parse(JSON.stringify(await models.input.findAll({where:{stepId:steps[step].id}})));
      if (!partial && !mergedStep.inputs) throw "Error finding inputs";
      mergedStep.outputs = JSON.parse(JSON.stringify(await models.output.findAll({where:{stepId:steps[step].id}})));
      if (!partial && !mergedStep.outputs) throw "Error finding outputs";
      let implementationCriteria = { stepId: steps[step].id };
      if (language) { implementationCriteria.language = language; } else if (implementationUnits) { implementationCriteria.language = implementationUnits[steps[step].name]; }
      mergedStep.implementation = JSON.parse(JSON.stringify(await models.implementation.findOne({where: implementationCriteria})));
      if (!partial && !mergedStep.implementation) throw "Error finding implementation.";
      mergedSteps.push(mergedStep);
    }
    workflow.steps = mergedSteps;
  } catch(error) {
    logger.error(error);
    throw error;
  }
  return workflow;

}

router.get('/define/:workflowId', async function(req, res, next) {

  try {
    res.render('define',{title:'Phenoflow', workflow:await getWorkflow(req.params.workflowId)});
  } catch(error) {
    logger.error("Get workflow error: " + error);
    res.sendStatus(500);
  }

});

router.post('/new', async function(req, res, next) {

  if (!req.body.name || !req.body.author || !req.body.about) return res.sendStatus(500);
  try {
    let workflow = await models.workflow.create({name:req.body.name, author:req.body.author, about:req.body.about});
    res.send({"id":workflow.id});
  } catch(error) {
    error = "Error adding workflow: " + (error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

router.post('/update/:id', async function(req, res, next) {

  if (!req.body.name || !req.body.author || !req.body.about) return res.sendStatus(500);
  try {
    await models.workflow.upsert({id:req.params.id, name: req.body.name, author: req.body.author, about: req.body.about});
    res.sendStatus(200);
  } catch(error) {
    error = "Error updating workflow: " + (error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

async function generateWorkflow(workflowId, language=null, implementationUnits=null, res) {

  let workflow = await getWorkflow(workflowId, language, implementationUnits);
  try {
    var generate = await got.post(config.get("generator.URL") + "/generate", {json:workflow.steps, responseType:"json"});
  } catch(error) {
    throw "Error contacting generator: " + error + " " + JSON.stringify(workflow.steps);
  }
  if (generate.statusCode==200 && generate.body && generate.body.workflow && generate.body.workflowInputs && generate.body.steps) {
    await Utils.createPFZipResponse(res, workflowId, workflow.name, generate.body.workflow, generate.body.workflowInputs, language?language:implementationUnits, generate.body.steps, workflow.about);
  } else {
    throw "Error generating workflow.";
  }

}

router.get("/generate/:workflowId/:language", async function(req, res, next) {

  if (req.body.implementationUnits) return res.sendStatus(404);
  try {
    await generateWorkflow(req.params.workflowId, req.params.language, null, res);
    res.sendStatus(200);
  } catch(error) {
    logger.debug("Generate workflow error: " + error);
    res.sendStatus(500);
  }

});

router.post("/generate/:workflowId", async function(req, res, next) {

  if (!req.body.implementationUnits) return res.sendStatus(404);
  try {
    await generateWorkflow(req.params.workflowId, null, req.body.implementationUnits, res);
  } catch(error) {
    logger.debug(error);
    res.sendStatus(500);
  }

});

module.exports = router;
