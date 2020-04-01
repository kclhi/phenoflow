const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if ( !req.body.inputId || !req.body.doc ) {

    res.sendStatus(500);

  } else {

    models.workflow.create({
      inputId: req.body.inputId,
      doc: req.body.doc
    }).then(
      (created)=>logger.info(created)
    ).then(
      ()=>res.sendStatus(200)
    );

  }

});

module.exports = router;
