const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if ( !req.body.outputId || !req.body.doc || !req.body.extension ) {

    res.status(500).send("Missing parameters.");

  } else {

    models.workflow.create({
      inputId: req.body.inputId,
      doc: req.body.doc,
      extension: req.body.extension
    }).then(
      (created)=>logger.info(created)
    ).then(
      ()=>res.sendStatus(200)
    );

  }

});

module.exports = router;
