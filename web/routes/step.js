const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if ( !req.body.stepId || !req.body.doc || !req.body.type || !req.body.language || !req.body.position || !req.body.workflowId  ) {
    res.status(500).send("Missing parameters.");
  } else {
    models.step.create({
      stepId: req.body.stepId,
      doc: req.body.doc,
      type: req.body.type,
      language: req.body.language,
      position: req.body.position,
      workflowId: req.body.workflowId
    }).then(
      (created)=>res.send({"id": created.id})
    ).catch(function(error) {
      logger.debug(error);
      res.send(error);
    });
  }
  
});

module.exports = router;
