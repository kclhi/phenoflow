const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const config = require('config');
const got = require('got');

const Utils = require('../util/utils');

router.get('/define', function(req, res, next) {

  res.render('define', { title: 'Express' });

});

router.get('/define/:workflowId', function(req, res, next) {

  res.render('define', { title: 'Express' });

});

router.post('/new', function(req, res, next) {

  if (!req.body.name || !req.body.author || !req.body.about) return res.sendStatus(500);

  models.workflow.create({
    name: req.body.name,
    author: req.body.author,
    about: req.body.about
  }).then((created)=>res.send({"id":created.id})).catch((error)=>res.status(500).send(error));

});

router.post('/update/:id', function(req, res, next) {

  if (!req.body.name || !req.body.author || !req.body.about) return res.sendStatus(500);

  models.workflow.upsert({
    id: req.params.id,
    name: req.body.name,
    author: req.body.author,
    about: req.body.about
  }).then((upserted)=>res.sendStatus(200)).catch((error)=>res.status(500).send(error));

});

async function generateWorkflow(req, res) {

  if (!req.body.implementationUnits && !req.params.language) return res.sendStatus(404);

  try {
    var workflow = await models.workflow.findOne({
      where: {
        id: req.params.workflowId
      }
    });
    if (!workflow) throw err;
  } catch(err) {
    logger.error("Error finding workflow: " + err);
    return res.sendStatus(500);
  }

  try {
    var steps = await models.step.findAll({
      where: {
        workflowId: req.params.workflowId
      }
    });
    if (!steps) throw err;
  } catch(err) {
    logger.error("Error finding steps: " + err);
    return res.sendStatus(500);
  }

  let mergedSteps = [];

  for (const step in steps) {
    let mergedStep = JSON.parse(JSON.stringify(steps[step]));
    try {
      mergedStep.inputs = await models.input.findAll({
        where: {
          stepId: steps[step].id
        }
      });
      if (!mergedStep.inputs) throw err;
    } catch(err) {
      logger.error("Error finding inputs: " + err);
      return res.sendStatus(500);
    }
    try {
      mergedStep.outputs = await models.output.findAll({
        where: {
          stepId: steps[step].id
        }
      });
    } catch(err) {
      if (!mergedStep.outputs) throw err;
      logger.error("Error finding outputs: " + err);
      return res.sendStatus(500);
    }
    try {
      if (req.params.language || req.body.implementationUnits[steps[step].name]) {
        mergedStep.implementation = await models.implementation.findOne({
          where: {
            stepId: steps[step].id,
            language: req.params.language?req.params.language:req.body.implementationUnits[steps[step].name]
          }
        });
      }
      if (!mergedStep.implementation) throw err;
    } catch(err) {
      logger.error("Error finding implementation: " + err);
      return res.sendStatus(500);
    }

    if (!mergedStep.implementation) {
      logger.error("No implementation units found (for this language permutation): " + steps[step].name + " not in " + JSON.stringify(req.body.implementationUnits));
      return res.sendStatus(500);
    }

    mergedSteps.push(mergedStep);
  }

  try {
    var generate = await got.post(config.get("generator.URL") + "/generate", {json: mergedSteps, responseType: "json"});
  } catch(error) {
    logger.error("Error contacting generator: " + error);
    return res.sendStatus(500);
  }

  if (generate.statusCode==200 && generate.body && generate.body.workflow && generate.body.workflowInputs && generate.body.steps) {
    await Utils.createPFZipResponse(res, req.params.workflowId, workflow.name, generate.body.workflow, generate.body.workflowInputs, req.params.language?req.params.language:req.body.implementationUnits, generate.body.steps, workflow.about);
  } else {
    res.sendStatus(500);
  }

}

router.get("/generate/:workflowId/:language", async(req, res, next)=>generateWorkflow(req, res));

router.post("/generate/:workflowId", async(req, res, next)=>generateWorkflow(req, res));

module.exports = router;
