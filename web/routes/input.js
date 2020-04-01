const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if ( !req.body.inputId || !req.body.doc || !req.body.stepId ) {

    res.sendStatus(500);

  } else {

    models.input.create({
      inputId: req.body.inputId,
      doc: req.body.doc,
      stepId: req.body.stepId
    }).then(
      (created)=>logger.info("Created new input.")
    ).then(
      ()=>res.sendStatus(200)
    );

  }

});

module.exports = router;
