const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const config = require('config');
const request = require('request');

router.post('/new', function(req, res, next) {

  if ( !req.body.author ) {

    res.sendStatus(500);

  } else {

    models.workflow.create({
      author: req.body.author
    }).then(
      (created)=>res.send({"id": created.id})
    );

  }

});

router.post("/generate/:workflowId", async function(req, res, next) {

  let steps = await models.step.findAll({
    where: {
      workflowId: req.params.workflowId
    }
  });

  let mergedSteps = [];

  for ( const step in steps ) {
    let mergedStep = JSON.parse(JSON.stringify(steps[step]));
    mergedStep.inputs = await models.input.findAll({
      where: {
        stepId: steps[step].id
      }
    });
    mergedStep.outputs = await models.output.findAll({
      where: {
        stepId: steps[step].id
      }
    });
    mergedStep.implementations = await models.implementation.findAll({
      where: {
        stepId: steps[step].id
      }
    });
    mergedSteps.push(mergedStep);
  }

  logger.debug(mergedSteps);
  
  request.post(config.get("generator.URL") + "/generate", {json: mergedSteps}, function(error, response, data) {
    if (!error && response.statusCode == 200) {
      res.sendStatus(200);
    } else {
      res.sendStatus(500);
    }
  });

  res.sendStatus(200);

});

module.exports = router;
