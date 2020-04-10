const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if (!req.body.language || !req.body.stepId || !req.files || Object.keys(req.files).length === 0) return res.status(400).send('No files were uploaded.');

  let uploadedFile = req.files.implementation;
  uploadedFile.mv("uploads/" + req.body.language + "/" + uploadedFile.name, function(err) {

    if (err) return res.status(500).send(err);
    models.implementation.create({
      fileName: uploadedFile.name,
      language: req.body.language,
      stepId: req.body.stepId
    }).then((created)=>res.send({"id":created.id}));

  });

});

router.post('/update/:stepId/:language', function(req, res, next) {

  if (!req.body.language || !req.files || Object.keys(req.files).length === 0) return res.status(400).send('No files were uploaded.');

  let uploadedFile = req.files.implementation;
  uploadedFile.mv("uploads/" + req.body.language + "/" + uploadedFile.name, function(error) {

    if (error) return res.status(500).send(error);
    models.implementation.update({
      fileName: uploadedFile.name,
      language: req.body.language,
      stepId: req.body.stepId?req.body.stepId:req.params.stepId // Leave connected to same step if not specified.
    },{
      where: {
        stepId: req.params.stepId,
        language: req.params.language
      }
    }).then((created)=>res.sendStatus(200)).catch((error)=>res.status(500).send(error));

  });

});

module.exports = router;
