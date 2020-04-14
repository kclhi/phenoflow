const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/:workflowId/:position', function(req, res, next) {

  if (!req.body.name || !req.body.doc || !req.body.type) { logger.debug("Missing params"); return res.status(500).send("Missing parameters."); }

  models.step.upsert({
    name: req.body.name,
    doc: req.body.doc,
    type: req.body.type,
    workflowId: req.params.workflowId,
    position: req.params.position
  }).then(function(upserted) {
    models.step.findOne({
      where: {
        workflowId: req.params.workflowId,
        position: req.params.position
      }
    }).then((step)=>res.send({"id":step.id})).catch((error)=>res.status(500).send(error));
  }).catch((error)=>res.status(500).send(error));

});

module.exports = router;
