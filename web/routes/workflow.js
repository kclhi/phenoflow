const express = require("express");
const router = express.Router();
const logger = require("../config/winston");
const models = require("../models");
const config = require("config");
const got = require("got");
const bcrypt = require("bcrypt");
const sanitizeHtml = require('sanitize-html');
const jwt = require('express-jwt');
const { v1: uuidv1 } = require("uuid");

const Workflow = require("../util/workflow");

/**
 * @swagger
 * /phenoflow/phenotype/all:
 *   post:
 *     summary: List phenotypes
 *     description: Retrieve a list of all phenotypes, or phenotypes matching the given criteria
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               importedId:
 *                 type: string
 *                 description: The ID grabbed from the import source. Often listed as a part of a definition's description.
 *                 example: XNIlg0YihF3u3iuI6IitMu0CNfQ
 *               name:
 *                 type: string
 *                 description: Phenotype name
 *                 example: Rheumatoid arthritis
 *     responses:
 *       200:
 *         description: A list of phenotypes
 */
router.post("/all", async function(req, res, next) {

  if(req.body.name) { 
    var workflowsByName = await Workflow.completeWorkflows(req.body.name, 0, Number.MAX_VALUE);
  } else {
    var workflowsByName = await Workflow.completeWorkflows("", 0, Number.MAX_VALUE);
  }
  if(req.body.importedId) var workflowsByImportedId = await Workflow.completeWorkflows(req.body.importedId, 0, limit=Number.MAX_VALUE);
  if(req.body.name&&workflowsByName&&req.body.importedId&&workflowsByImportedId) workflowsByName = workflowsByName.filter(workflowByName=>workflowsByImportedId.map(workflowByImportedId=>workflowByImportedId.id).includes(workflowByName.id));
  res.send(await Promise.all(workflowsByName.map(async (workflow) => {
    let user = await models.user.findOne({where:{name: workflow.userName}});
    return {"id":workflow.id, "name":workflow.name, "about":workflow.about, "user": user.name};
  })));

});

/**
 * @swagger
 * /phenoflow/phenotype/connectors:
 *   post:
 *     summary: Get connector IDs
 *     description: Retrieve a list of those phenotypes that only differ from the definition associated with the supplied ID by connector type
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: The ID of the definition for which to find associated connectors (retrieved from a previous API call)
 *                 example: 5
 *     responses:
 *       200:
 *         description: A list of phenotypes
 */
router.post("/connectors", async function(req, res, next) {

  let children = await models.child.findAll({where:{parentId:req.body.id}});
  let connectors = children.map((child)=>({"id":child.workflowId, "connector":child.distinctStepName.replace("read-potential-cases-", "")}));
  connectors.push({"id":req.body.id, "connector":["fhir", "i2b2", "omop", "disc"].filter(connectorLabel=>!connectors.map(connector=>connector.connector).includes(connectorLabel))[0]});
  res.send(connectors);

});

router.post("/new", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name || !req.body.about || !req.body.userName) return res.sendStatus(500);
  if(!req.body.id) req.body.id = uuidv1();
  try {
    let workflow = await models.workflow.create({id:sanitizeHtml(req.body.id), name:sanitizeHtml(req.body.name), about:sanitizeHtml(req.body.about), userName:sanitizeHtml(req.body.userName)});
    res.send({"id":workflow.id});
  } catch(error) {
    error = "Error adding workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

router.post("/update/:id", jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {

  if(!req.body.name||!req.body.about||!req.user.sub) return res.sendStatus(500);

  try {
    let workflow = await models.workflow.findOne({where:{id:req.params.id}});
    if(!(workflow.userName==req.user.sub)) return res.sendStatus(500);
    await models.workflow.upsert({id:req.params.id, name:req.body.name, about:req.body.about, userName:req.user.sub,});
    res.sendStatus(200);
  } catch(error) {
    error = "Error updating workflow: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    res.status(500).send(error);
  }

});

module.exports = router;
