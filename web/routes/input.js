const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/:stepId', async function(req, res, next) {

  if(!req.body.doc) return res.status(500).send("Missing parameters.");
  try {
    await models.input.upsert({doc:req.body.doc, stepId:req.params.stepId});
    res.sendStatus(200);
  } catch(error) {
    error = "Error adding input: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

module.exports = router;
