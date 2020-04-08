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

router.post('/new', function(req, res, next) {

  if (!req.body.name || !req.body.author || !req.body.about) {
    res.sendStatus(500);
  } else {
    models.workflow.create({
      name: req.body.name,
      author: req.body.author,
      about: req.body.about
    }).then(
      (created)=>res.send({"id": created.id})
    );
  }

});

router.post("/generate/:workflowId", async function(req, res, next) {

  if ( !req.body.implementationUnits ) {
    res.sendStatus(404);
  } else {
    try {
      var workflow = await models.workflow.findOne({
        where: {
          id: req.params.workflowId
        }
      });
    } catch(err) {
      logger.error("Error finding workflow: " + err);
      res.sendStatus(500);
      return;
    }

    try {
      var steps = await models.step.findAll({
        where: {
          workflowId: req.params.workflowId
        }
      });
    } catch(err) {
      logger.error("Error finding steps: " + err);
      res.sendStatus(500);
      return;
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
      } catch(err) {
        logger.error("Error finding inputs: " + err);
        res.sendStatus(500);
        return;
      }
      try {
        mergedStep.outputs = await models.output.findAll({
          where: {
            stepId: steps[step].id
          }
        });
      } catch(err) {
        logger.error("Error finding outputs: " + err);
        res.sendStatus(500);
        return;
      }
      try {
        if ( req.body.implementationUnits[steps[step].stepId] ) {
          mergedStep.implementation = await models.implementation.findOne({
            where: {
              stepId: steps[step].id,
              language: req.body.implementationUnits[steps[step].stepId]
            }
          });
        }
      } catch(err) {
        logger.error("Error finding implementation: " + err);
        res.sendStatus(500);
        return;
      }

      if (!mergedStep.implementation) {
        logger.error("No implementation units found (for this language permutation): " + steps[step].stepId + " not in " + req.body.implementationUnits);
        res.sendStatus(500);
        return;
      }

      mergedSteps.push(mergedStep);
    }

    try {
      var generate = await got.post(config.get("generator.URL") + "/generate", {json: mergedSteps, responseType: "json"});
    } catch(error) {
      logger.error("Error contacting generator: " + error);
      res.sendStatus(500);
      return;
    }

    logger.debug("Response from generator: " + generate.body + " " + generate.body.workflow + " " + generate.body.workflowInputs + " " + generate.body.steps);

    if (generate.statusCode==200 && generate.body && generate.body.workflow && generate.body.workflowInputs && generate.body.steps) {
      await Utils.createPFZipResponse(res, req.params.workflowId, workflow.name, generate.body.workflow, generate.body.workflowInputs, req.body.implementationUnits, generate.body.steps, workflow.about);
    } else {
      res.sendStatus(500);
    }

  }

});

module.exports = router;
