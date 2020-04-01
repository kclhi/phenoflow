var express = require('express');
var router = express.Router();
const logger = require('../config/winston');

/* GET home page. */
router.get('/', function(req, res, next) {

  logger.info("Homepage requested");
  res.render('index', { title: 'Express' });
  
});

module.exports = router;
