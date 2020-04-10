const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if (!req.body.doc || !req.body.extension || !req.body.stepId) {
    res.status(500).send("Missing parameters.");
  } else {
    models.output.create({
      doc: req.body.doc,
      extension: req.body.extension,
      stepId: req.body.stepId
    }).then(
      (created)=>res.send({"id": created.id})
    );
  }

});

router.post('/update/:stepId', function(req, res, next) {

  if (!req.body.doc || !req.body.extension) return res.status(500).send("Missing parameters.");

  models.output.update({
    doc: req.body.doc,
    extension: req.body.extension,
    stepId: req.body.stepId?req.body.stepId:req.params.stepId // Leave connected to same step if not specified.
  },{
    where: {
      stepId: req.params.stepId
    }
  }).then((updated)=>updated==1?res.sendStatus(200):res.sendStatus(500)).catch((error)=>res.status(500).send(error));

});

module.exports = router;
