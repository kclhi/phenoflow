const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if (!req.files || Object.keys(req.files).length === 0) return res.status(400).send('No files were uploaded.');

  let uploadedFile = req.files.implementation;

  uploadedFile.mv("uploads/" + uploadedFile.name, function(err) {

    if (err) return res.status(500).send(err);
    res.sendStatus(200);

  });

});

module.exports = router;
