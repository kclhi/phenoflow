const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if (!req.body.doc || !req.body.stepId) return res.sendStatus(500);

  models.input.create({
    doc: req.body.doc,
    stepId: req.body.stepId
  }).then((created)=>res.send({"id": created.id})).catch((error)=>res.status(500).send(error));

});

router.post('/update/:stepId', function(req, res, next) {

  if (!req.body.doc) return res.status(500).send("Missing parameters.");

  models.input.update({
    doc: req.body.doc,
    stepId: req.body.stepId?req.body.stepId:req.params.stepId // Leave connected to same step if not specified.
  },{
    where: { stepId: req.params.stepId }
  }).then((updated)=>updated==1?res.sendStatus(200):res.sendStatus(500)).catch((error)=>res.status(500).send(error));

});

module.exports = router;
