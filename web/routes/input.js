const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sanitizeHtml = require('sanitize-html');
const jwt = require('express-jwt');
const config = require("config");
const Workflow = require("../util/workflow");

router.post('/:stepId', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.doc||!req.user.sub) return res.status(500).send("Missing parameters.");

  try {
    let step = await models.step.findOne({where:{id:req.params.stepId}});
    if (!step) return res.status(500).send("");
    let workflow = await models.workflow.findOne({where:{id:step.workflowId}});
    if (!workflow) return res.status(500).send("");
    if(!(workflow.userName==req.user.sub)) return res.sendStatus(500);
    await models.input.upsert({doc:sanitizeHtml(req.body.doc), stepId:req.params.stepId});
    await Workflow.workflowComplete(workflow.id);
    res.sendStatus(200);
  } catch(error) {
    error = "Error adding input: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

module.exports = router;
