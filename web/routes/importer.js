const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const jwt = require('express-jwt');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');
const config = require("config");

async function createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, language, implementationTemplatePath, substitutions) {

  try {
    var step = await models.step.create({name:stepName, doc: stepDoc, type: stepType, workflowId:workflowId, position:position});
  } catch(error) {
    error = "Error importing step: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    throw error;
  }

  try {
    await models.input.create({doc:inputDoc, stepId:step.id});
  } catch(error) {
    error = "Error impirting step input: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    throw error;
  }

  try {
    await models.output.create({doc:outputDoc, extension:outputExtension, stepId:step.id});
  } catch(error) {
    error = "Error importing step output: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    throw error;
  }

  try {
    await models.implementation.upsert({fileName:fileName, language:language, stepId:step.id});

  } catch(error) {
    error = "Error creating step implementation: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    throw error;
  }

  let implementationTemplate = await fs.readFile(implementationTemplatePath, "utf8");
  for(var substitution in substitutions) implementationTemplate = implementationTemplate.replace(new RegExp("\\\[" + substitution + "\\\]", "g"), substitutions[substitution]);
  const destination = "uploads/" + workflowId + "/" + language;

  try {
    await fs.stat(destination);
  } catch(error) {
    await fs.mkdir(destination, {recursive:true});
  }

  fs.writeFile(destination + "/" + fileName.replace(/\//g, ""), implementationTemplate);

}

router.post('/', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name || !req.body.about || !req.body.codeCategories || !req.body.userName) {
    logger.debug("Missing params.");
    return res.status(500).send("Missing params.");
  }

  const NAME = sanitizeHtml(req.body.name);
  const ABOUT = sanitizeHtml(req.body.about);

  try {
    var workflow = await models.workflow.create({name:NAME, about:ABOUT, userName:sanitizeHtml(req.body.userName), });
  } catch(error) {
    error = "Error parsing CSV to workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

  const WORKFLOW_ID = workflow.id;
  const LANGUAGE = "python";
  const OUTPUT_EXTENSION = "csv";

  // Add data read
  try {
    await createStep(WORKFLOW_ID, "read-potential-cases", "Read potential cases", "load", 1, "Potential cases of " + NAME, "Initial potential cases, read from disc.", OUTPUT_EXTENSION, "read-potential-cases.py", LANGUAGE, "templates/read-potential-cases.py", {"PHENOTYPE":NAME.toLowerCase().replace(/ /g, "-")});
  } catch(error) {
    logger.debug("Error creating first step from import: " + error);
    return res.status(500).send(error);
  }

  var position = 2;
  const CODE_CATEGORIES = req.body.codeCategories;

  // For each code set
  for(var code in CODE_CATEGORIES) {
    let stepName = code.toLowerCase().replace(/ /g, "-");
    let stepDoc = "Identify " + code;
    let stepType = "logic";
    let inputDoc = "Potential cases of " + NAME;
    let outputDoc = "Patients with read codes indicating " + NAME + " related events in electronic health record.";
    let fileName = code.toLowerCase().replace(/ /g, "-") + ".py";

    try {
      await createStep(WORKFLOW_ID, stepName, stepDoc, stepType, position, inputDoc, outputDoc, OUTPUT_EXTENSION, fileName, LANGUAGE, "templates/codelist.py", {"PHENOTYPE":NAME.toLowerCase().replace(/ /g, "-"), "CODE_CATEGORY":code.toLowerCase().replace(/ /g, "-"), "CODE_LIST":'"' + CODE_CATEGORIES[code].join('","') + '"'});
    } catch(error) {
      error = "Error creating imported step: " + error;
      logger.debug(error);
      return res.status(500).send(error);
    }

    position++;
  }

  // Add file write
  try {
    await createStep(WORKFLOW_ID, "output-cases", "Output cases", "output", position, "Potential cases of " + NAME, "Output containing patients flagged as having this type of " + NAME, OUTPUT_EXTENSION, "output-cases.py", LANGUAGE, "templates/output-cases.py", {"PHENOTYPE":NAME.toLowerCase().replace(/ /g, "-")});
  } catch(error) {
    logger.debug("Error creating last step from import: " + error);
    return res.status(500).send(error);
  }

  res.sendStatus(200);

});

module.exports = router;
