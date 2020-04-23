const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sanitizeHtml = require('sanitize-html');
const jwt = require('express-jwt');
const config = require("config");

router.post('/:stepId', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.doc || !req.body.extension) return res.status(500).send("Missing parameters.");
  try {
    await models.output.upsert({doc:sanitizeHtml(req.body.doc), extension:sanitizeHtml(req.body.extension), stepId:req.params.stepId});
    res.sendStatus(200);
  } catch(error) {
    error = "Error adding output: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

module.exports = router;
