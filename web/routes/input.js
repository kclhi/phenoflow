const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/:stepId', function(req, res, next) {

  if (!req.body.doc) return res.status(500).send("Missing parameters.");
  models.input.upsert({doc:req.body.doc, stepId:req.params.stepId}).then((upserted)=>res.sendStatus(200)).catch((error)=>res.status(500).send(error));

});

module.exports = router;
