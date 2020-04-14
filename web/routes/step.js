const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/:workflowId/:position', async function(req, res, next) {

  if (!req.body.name || !req.body.doc || !req.body.type) { logger.debug("Missing params"); return res.status(500).send("Missing parameters."); }

  try {
    await models.step.upsert({name:req.body.name, doc: req.body.doc, type:req.body.type, workflowId:req.params.workflowId, position:req.params.position});
    let stepId = await models.step.findOne({where:{workflowId:req.params.workflowId, position:req.params.position}});
    res.send({"id":stepId.id});
  } catch(error) {
    error = "Error adding step: " + (error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

module.exports = router;
