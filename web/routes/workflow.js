const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');

router.post('/new', function(req, res, next) {

  if ( !req.body.author ) {

    res.sendStatus(500);

  } else {

    models.workflow.create({
      author: req.body.author
    }).then(
      (created)=>res.send({"id": created.id})
    );

  }

});

module.exports = router;
