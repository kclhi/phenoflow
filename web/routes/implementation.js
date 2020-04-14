const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/:stepId/:language', async function(req, res, next) {

  if (!req.files || Object.keys(req.files).length === 0) return res.status(400).send('No files were uploaded.');

  let uploadedFile = req.files.implementation;
  uploadedFile.mv("uploads/" + req.params.language + "/" + uploadedFile.name, async function(error) {

    if (error) return res.status(500).send(error);
    try {
      await models.implementation.upsert({fileName:uploadedFile.name, language:req.params.language, stepId:req.params.stepId});
      res.sendStatus(200);
    } catch(error) {
      error = "Error adding implementation: " + (error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      res.status(500).send(error);
    }

  });

});

module.exports = router;
