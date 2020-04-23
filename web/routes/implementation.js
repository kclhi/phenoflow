const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sanitizeHtml = require('sanitize-html');
const jwt = require('express-jwt');
const config = require("config");

router.post('/:stepId/:language', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.files || Object.keys(req.files).length === 0) return res.status(400).send('No files were uploaded.');

  let uploadedFile = req.files.implementation;
  let step;
  try {
    step = await models.step.findOne({where:{id: req.params.stepId}});
  } catch(error) {
    error = "Error getting workflowId for implementation: " + error;
    logger.debug(error);
    res.status(500).send(error);
  }

  uploadedFile.mv("uploads/" + step.workflowId + "/" + req.params.language + "/" + uploadedFile.name, async function(error) {

    if(error) return res.status(500).send(error);
    try {
      await models.implementation.upsert({fileName:uploadedFile.name, language:req.params.language, stepId:req.params.stepId});
      res.sendStatus(200);
    } catch(error) {
      error = "Error adding implementation: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      res.status(500).send(error);
    }

  });

});

module.exports = router;
