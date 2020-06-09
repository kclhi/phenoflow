const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const jwt = require('express-jwt');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');
const config = require("config");
const Workflow = require("../util/workflow");

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
    error = "Error importing step input: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
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

function clean(input, spaces=false) {

  input = input.replace(/\//g, "").replace(/(\s)?\(.*\)/g, "");
  if(!spaces) input = input.replace(/ /g, "-");
  return input;

}

async function createWorkflow(name, about, userName) {

  try {
    var workflow = await models.workflow.create({name:name, about:about, userName:sanitizeHtml(userName)});
    return workflow.id;
  } catch(error) {
    error = "Error creating workflow for CSV: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

}

async function createWorkflowSteps(workflowId, name, language, outputExtension, userName, codeCategories) {

  let position = 2;

  // For each code set
  for(var code in codeCategories) {
    let stepName = clean(code.toLowerCase());
    let stepDoc = "Identify " + clean(code, true);
    let stepType = "logic";
    let inputDoc = "Potential cases of " + name;
    let outputDoc = "Patients with read codes indicating " + name + " related events in electronic health record.";
    let fileName = clean(code.toLowerCase()) + ".py";

    try {
      await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, language, "templates/codelist.py", {"PHENOTYPE":name.toLowerCase().replace(/ /g, "-"), "CODE_CATEGORY":clean(code.toLowerCase()), "CODE_LIST":'"' + codeCategories[code].join('","') + '"', "AUTHOR":userName, "YEAR":new Date().getFullYear()});
    } catch(error) {
      error = "Error creating imported step: " + error;
      logger.debug(error);
      return res.status(500).send(error);
    }

    position++;
  }

  // Add file write
  try {
    await createStep(workflowId, "output-cases", "Output cases", "output", position, "Potential cases of " + name, "Output containing patients flagged as having this type of " + name, outputExtension, "output-cases.py", language, "templates/output-cases.py", {"PHENOTYPE":clean(name.toLowerCase())});
  } catch(error) {
    logger.debug("Error creating last step from import: " + error);
    return res.status(500).send(error);
  }

  await Workflow.workflowComplete(workflowId);
  await Workflow.workflowChild(workflowId);

}

router.post('/', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name || !req.body.about || !req.body.codeCategories || !req.body.userName) {
    logger.debug("Missing params.");
    return res.status(500).send("Missing params.");
  }
  const NAME = clean(sanitizeHtml(req.body.name));
  const ABOUT = sanitizeHtml(req.body.about);
  let workflowId = await createWorkflow(NAME, ABOUT, req.body.userName);
  let language = "python";
  const OUTPUT_EXTENSION = "csv";

  // Add data read (csv)
  try {
    await createStep(workflowId, "read-potential-cases", "Read potential cases", "load", 1, "Potential cases of " + NAME, "Initial potential cases, read from disc.", OUTPUT_EXTENSION, "read-potential-cases.py", language, "templates/read-potential-cases.py", {"PHENOTYPE":clean(NAME.toLowerCase())});
  } catch(error) {
    logger.debug("Error creating first step from import: " + error);
    return res.status(500).send(error);
  }

  await createWorkflowSteps(workflowId, NAME, language, OUTPUT_EXTENSION, req.body.userName, req.body.codeCategories);
  workflowId = await createWorkflow(NAME, ABOUT, req.body.userName);
  language = "js";

  // Add data read (i2b2)
  try {
    await createStep(workflowId, "read-potential-cases-i2b2", "Read potential cases from i2b2", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from i2b2.", OUTPUT_EXTENSION, "read-potential-cases-i2b2.js", language, "templates/read-potential-cases-i2b2.js", {"PHENOTYPE":clean(NAME.toLowerCase())});
  } catch(error) {
    logger.debug("Error creating first step from import: " + error);
    return res.status(500).send(error);
  }

  await createWorkflowSteps(workflowId, NAME, language, OUTPUT_EXTENSION, req.body.userName, req.body.codeCategories);
  res.sendStatus(200);

});

module.exports = router;
