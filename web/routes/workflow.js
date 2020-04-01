const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

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

  for ( const step in steps ) {
    let inputs = await models.input.findAll({
      where: {
        stepId: steps[step].id
      }
    });
    let outputs = await models.output.findAll({
      where: {
        stepId: steps[step].id
      }
    });
    let implementations = await models.implementation.findAll({
      where: {
        stepId: steps[step].id
      }
    });
    logger.info(steps);
    logger.info(inputs);
    logger.info(outputs);
    logger.info(implementations);
    res.sendStatus(200);
  }

});

module.exports = router;
