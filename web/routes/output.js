const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/:stepId', async function(req, res, next) {

  if (!req.body.doc || !req.body.extension) return res.status(500).send("Missing parameters.");
  try {
    await models.output.upsert({doc:req.body.doc, extension:req.body.extension, stepId:req.params.stepId});
    res.sendStatus(200);
  } catch(error) {
    error = "Error adding output: " + (error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

module.exports = router;
