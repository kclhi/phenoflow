const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if (!req.body.name || !req.body.doc || !req.body.type || !req.body.position || !req.body.workflowId) return res.status(500).send("Missing parameters.");

  models.step.create({
    name: req.body.name,
    doc: req.body.doc,
    type: req.body.type,
    position: req.body.position,
    workflowId: req.body.workflowId
  }).then((created)=>res.send({"id":created.id})).catch((error)=>res.status(500).send(error));

});

router.post('/update/:workflowId/:position', function(req, res, next) {

  if (req.body.workflowId) return res.status(500).send("Cannot move existing steps between workflows.");
  if (!req.body.name || !req.body.doc || !req.body.type || !req.body.position) return res.status(500).send("Missing parameters.");

  models.step.findOne({
    where: {
      workflowId: req.params.workflowId,
      position: req.params.position
    }
  }).then(function(step) {
    models.step.update({
      name: req.body.name,
      doc: req.body.doc,
      type: req.body.type,
      position: req.body.position
    },{
      where: {
        id: step.id
      }
    }).then((updated)=>res.send({"id":step.id})).catch((error)=>res.status(500).send(error));
  }).catch((error)=>res.status(500).send(error));


});

module.exports = router;
