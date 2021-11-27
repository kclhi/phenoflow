const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sequelize = require('sequelize');
const op = sequelize.Op;
const jwt = require('express-jwt');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');
const AdmZip = require('adm-zip');
const parse = require('neat-csv');

const config = require("config");
const WorkflowUtils = require("../util/workflow");
const ImporterUtils = require("../util/importer");
const Workflow = require('../util/workflow');

/**
 * @swagger
 * /phenoflow/importer/importCodelists:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Import a set of codelists
 *     description: Create a phenotype definitions based upon a collection of codelists
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               csvs:
 *                 type: string
 *                 description: A zipped folder containing a collection of codelists as CSVs
 *                 format: binary
 *               name:
 *                 type: string
 *                 description: The name of the new definition
 *                 example: Diabetes
 *               about:
 *                 type: string
 *                 description: A description of the new definition
 *                 example: Diabetes phenotype developed at KCL
 *               userName:
 *                 type: string
 *                 description: the name of a pre-registered author to whom the definition should be attributed
 *                 example: martinchapman
 *     responses:
 *       200:
 *         description: Definition added.
 */
router.post('/importCodelists', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(req.files&&req.files.csvs) {
    let zip;
    try { 
      zip = new AdmZip(req.files.csvs.data);
    } catch(zipError) { 
      logger.error(zipError);
      return res.status(500).send(zipError.message);
    }
    req.body.csvs = [];
    for(let entry of zip.getEntries()) req.body.csvs.push({"filename":entry.entryName, "content":await parse(entry.getData().toString())});
    let uniqueCSVs = req.body.csvs.filter(({filename}, index)=>!req.body.csvs.map(csv=>csv.filename).includes(filename, index+1));
    req.body.about = req.body.about+" - "+ImporterUtils.hash(uniqueCSVs.map(csv=>csv.content));
  }
  if(!req.body.csvs||!req.body.name||!req.body.about||!req.body.userName) res.status(500).send("Missing params.");
  try {
    if(await Importer.importLists(req.body.csvs, req.body.name, req.body.about, req.body.userName, ImporterUtils.getValue, ImporterUtils.getDescription, "code")) return res.sendStatus(200);
    else return res.sendStatus(500);
  } catch(importListsError) {
    logger.error(importListsError);
    return res.sendStatus(500);
  }
});

/**
 * @swagger
 * /phenoflow/importer/importKeywordList:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Import a list of keywords
 *     description: Create a phenotype definitions based upon a list of keywords
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               keywords:
 *                 type: string
 *                 description: A CSV file listing keywords
 *                 format: binary
 *               name:
 *                 type: string
 *                 description: The name of the new definition
 *                 example: Diabetes
 *               about:
 *                 type: string
 *                 description: A description of the new definition
 *                 example: Diabetes phenotype developed at KCL
 *               userName:
 *                 type: string
 *                 description: the name of a pre-registered author to whom the definition should be attributed
 *                 example: martinchapman
 *     responses:
 *       200:
 *         description: Definition added
 */
router.post('/importKeywordList', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(req.files&&req.files.keywords) {
    req.body.keywords = {"filename":req.files.keywords.name, "content":await parse(req.files.keywords.data.toString())};
    req.body.about = req.body.about+" - "+ImporterUtils.hash(req.body.keywords.content);
  }
  if(!req.body.keywords||!req.body.name||!req.body.about||!req.body.userName) res.status(500).send("Missing params.");
  function getValue(row) {
    if(row["keyword"]) return row["keyword"].replace(/\\\\b/g, "");
    return 0;
  }
  function getDescription(row) {
    let description = row["keyword"].replace(/\\\\b/g, "");
    if(description&&description.includes(" ")) description=description.split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(ImporterUtils.clean(word))).join(" ");
    return description;
  }
  
  if(await Importer.importLists([req.body.keywords], req.body.name, req.body.about, req.body.userName, getValue, getDescription, "keywords")) return res.sendStatus(200);
  else return res.sendStatus(500);
});

/**
 * @swagger
 * /phenoflow/importer/importSteplist:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Import a steplist
 *     description: Create a phenotype definitions based upon a list of steps
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               steplist:
 *                 type: string
 *                 description: The list of steps, as a file formatted according to the Phenoflow import standard
 *                 format: binary
 *               csvs:
 *                 type: string
 *                 description: A zipped folder containing a collection of the CSVs referenced in the steplist, including branches (and their CSVs)
 *                 format: binary
 *               name:
 *                 type: string
 *                 description: The name of the new definition
 *                 example: Diabetes
 *               about:
 *                 type: string
 *                 description: A description of the new definition
 *                 example: Diabetes phenotype developed at KCL
 *               userName:
 *                 type: string
 *                 description: the name of a pre-registered author to whom the definition should be attributed
 *                 example: martinchapman
 *     responses:
 *       200:
 *         description: Definition added
 */
router.post('/importSteplist', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(req.files&&req.files.steplist&&req.files.csvs) {
    req.body.steplist = {"filename":req.files.steplist.name, "content":await parse(req.files.steplist.data.toString())};
    let zip;
    try { 
      zip = new AdmZip(req.files.csvs.data);
    } catch(zipError) { 
      logger.error(zipError);
      return res.status(500).send(zipError.message);
    }
    req.body.csvs = [];
    for(let entry of zip.getEntries()) req.body.csvs.push({"filename":entry.entryName, "content":await parse(entry.getData().toString())});
    let id = await ImporterUtils.steplistHash(req.body.steplist, req.body.csvs);
    req.body.about = req.body.about+" - "+id;
  }
  if(!req.body.steplist||!req.body.name||!req.body.about||!req.body.userName||!req.body.csvs) res.status(500).send("Missing params.");
  let list;
  let uniqueCSVs = req.body.csvs.filter(({filename}, index)=>!req.body.csvs.map(csv=>csv.filename).includes(filename, index+1));
  try {
    list = await Importer.getSteplist(req.body.steplist, uniqueCSVs, req.body.name, req.body.userName);
  } catch(getStepListError) {
    logger.error(getStepListError);
    return res.sendStatus(500);
  }
  try {
    if(await Importer.importPhenotype(req.body.name, req.body.about, null, req.body.userName, null, list)) return res.sendStatus(200);
    else return res.sendStatus(500);
  } catch(importPhenotypeError) {
    logger.error(importPhenotypeError);
    return res.sendStatus(500);
  }
});

/**
 * @swagger
 * /phenoflow/importer/addConnector:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Add a new connector
 *     description: Add a new connector to an existing phenotype definition
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               implementationTemplate:
 *                 type: string
 *                 format: binary
 *               existingWorkflowIds:
 *                 type: array
 *                 description: The IDs of the workflows to which to add the new connector (single values also accepted for individual workflows)
 *                 example: [1, 2]
 *               dataSource:
 *                 type: string
 *                 description: A description of the data source targeted by the connector
 *                 example: FHIR
 *               language:
 *                 type: string
 *                 description: The language in which the connector has been developed
 *                 example: python, js or KNIME
 *     responses:
 *       200:
 *         description: Connector added
 */
router.post('/addConnector', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.files.implementationTemplate||!req.body.existingWorkflowIds||!req.body.dataSource||!req.body.language) res.status(500).send("Missing params.");
  if(req.body.language&&!config.get("workflow.LANGUAGES").includes(req.body.language)) res.send("Supported language are: "+config.get("workflow.LANGUAGES").join(" ")).status(500);
  const OUTPUT_EXTENSION = "csv";
  for(let existingWorkflowId of req.body.existingWorkflowIds) {
    let existingWorkflow = await Workflow.workflow(await Workflow.getWorkflow(existingWorkflowId));
    for(let step of existingWorkflow.steps) {
      step.stepName = step.name;
      step.stepDoc = step.doc;
      step.stepType = step.type;
      step.inputDoc = step.inputs[0].doc;
      step.outputDoc = step.outputs[0].doc;
      step.outputExtension = step.outputs[0].extension;
      for(let implementation in step.implementations) {
        const source = "uploads/"+existingWorkflow.id+"/"+step.implementations[implementation].language;
        let sourceFile = await fs.readFile(source+"/"+step.implementations[implementation].fileName.replace(/\//g, ""), "utf8");
        step.implementations[implementation].implementationTemplate = sourceFile;
      }
    }
    let implementationTemplate = req.files.implementationTemplate;
    existingWorkflow.steps[0] = await Importer.getStep("read-potential-cases-"+ImporterUtils.clean(req.body.dataSource), "Read potential cases from "+req.body.dataSource, "external", 1, existingWorkflow.steps[0].inputDoc, "Initial potential cases, read from "+req.body.dataSource, OUTPUT_EXTENSION, [{"fileName":implementationTemplate.name, "language":req.body.language, "implementationTemplate":implementationTemplate.data.toString(), "substitutions":{"PHENOTYPE":ImporterUtils.clean(existingWorkflow.name.toLowerCase())}}]);
    let duplicatedWorkflowId = await Importer.createWorkflow(existingWorkflow.name, existingWorkflow.about, existingWorkflow.userName);
    await Importer.createSteps(duplicatedWorkflowId, existingWorkflow.steps);
    await WorkflowUtils.workflowComplete(duplicatedWorkflowId);
    await WorkflowUtils.workflowChild(duplicatedWorkflowId);
  }
  res.sendStatus(200);
});

//

class Importer {

  static async getSteplist(steplist, csvs, name, userName) {
    let list=[];
    for(let row of steplist.content) {
      if(row["logicType"]=="codelist") {
        let file = row["param"].split(":")[0];
        let requiredCodes = row["param"].split(":")[1];
        let categories = ImporterUtils.getCategories([csvs.filter((csv)=>csv.filename==file)[0]], ImporterUtils.clean(name.toLowerCase())==ImporterUtils.clean(ImporterUtils.getName(file).toLowerCase())?name:ImporterUtils.getName(file));
        // Prepare additional terms to differentiate categories, if as a part of a steplist the same categories are identified for different lists
        let fileCategory = ImporterUtils.getFileCategory(csvs.filter((csv)=>csv.filename==file)[0].content, name);
        list.push({"logicType":"codelist", "language":"python", "categories":categories, "requiredCodes":requiredCodes, "fileCategory":fileCategory});
      } else if(row["logicType"]=="codelistExclude") {
        let file = row["param"].split(":")[0];
        let categoriesExclude = ImporterUtils.getCategories([csvs.filter((csv)=>csv.filename==file)[0]], ImporterUtils.getName(row["param"]));
        list.push({"logicType":"codelistExclude", "language":"python", "categoriesExclude":categoriesExclude});
      } else if(row["logicType"]=="age") {
        list.push({"logicType":"age", "language":"python", "ageLower":row["param"].split(":")[0], "ageUpper":row["param"].split(":")[1]});
      } else if(row["logicType"]=="lastEncounter") {
        list.push({"logicType":"lastEncounter", "language":"python", "maxYears":row["param"]});
      } else if(row["logicType"]=="codelistsTemporal") {
        let fileBefore = row["param"].split(":")[0];
        let fileAfter = row["param"].split(":")[1];
        let codesBefore = [...new Set(csvs.filter((csv)=>csv.filename==fileBefore).map((csv)=>csv.content)[0].map((row)=>"\""+ImporterUtils.getValue(row)+"\""))];
        let categoriesAfter = ImporterUtils.getCategories([csvs.filter((csv)=>csv.filename==fileAfter)[0]], ImporterUtils.getName(fileAfter));
        let minDays = row["param"].split(":")[2];
        let maxDays = row["param"].split(":")[3];
        list.push({"logicType":"codelistsTemporal", "language":"python", "nameBefore":ImporterUtils.getName(fileBefore), "codesBefore":codesBefore, "categoriesAfter":categoriesAfter, "minDays":minDays, "maxDays":maxDays});
      } else if(row["logicType"]=="branch") {
        let nestedSteplist = csvs.filter(csv=>csv.filename==row["param"])[0];
        let branchList = await Importer.getSteplist(nestedSteplist, csvs, name, userName);
        let nestedWorkflowName = ImporterUtils.summariseSteplist(nestedSteplist);
        let id = ImporterUtils.steplistHash(nestedSteplist, csvs);
        let workflowId = await Importer.importNestedPhenotype(name, nestedWorkflowName, id+" - "+nestedWorkflowName.charAt(0).toUpperCase()+nestedWorkflowName.substring(1), userName, branchList);
        list.push({"logicType":"branch", "nestedWorkflowName":nestedWorkflowName, "nestedWorkflowId":workflowId});
      }
    }
    return list;
  }

  static async importNestedPhenotype(name, parentStepName, about, userName, list) {
    const OUTPUT_EXTENSION = "csv";
    let steps = await Importer.getGroupedWorkflowStepsFromList(name, OUTPUT_EXTENSION, list, userName, 1);
    steps.pop();
    steps.push(await this.getOutputCasesConditional(steps.flat().length+1, name, OUTPUT_EXTENSION, "python", parentStepName, steps));
    steps = steps.flat();
    let existingWorkflowId = await Importer.existingWorkflow(name, about, userName);
    let workflowId = existingWorkflowId||await Importer.createWorkflow(name, about, userName);
    let existingWorkflowChanged = await Importer.importChangesExistingWorkflow(existingWorkflowId, steps);
    if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) { 
      if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);
      await Importer.createSteps(workflowId, steps);
    }
    return workflowId;
  }

  static async getOutputCasesConditional(position, name, outputExtension, language, parentStepName, steps) { 
    let stepName = "output-"+ImporterUtils.clean(parentStepName).toLowerCase()+"-cases";
    let fileName = stepName+".py";
    try {
      return await Importer.getStep(stepName, "Output cases", "output", position, "Potential cases of " + name, "Output containing patients flagged as having this type of " + name, outputExtension, [{"fileName":fileName, "language":language, "implementationTemplatePath":"templates/output-codelist-multiple.py", "substitutions":{"PHENOTYPE":ImporterUtils.clean(name.toLowerCase()), "NESTED":ImporterUtils.clean(parentStepName.toLowerCase()), "CASES":JSON.stringify(steps.filter(steps=>steps.filter(step=>!step.stepDoc.startsWith("Exclude")).length==steps.length).map(steps=>steps.map(step=>step.stepName+"-identified")))}}]);
    } catch(error) {
      error = "Error creating output conditional for nested step from import: " + error;
      throw error;
    }
  }

  static async importLists(csvs, name, about, author, valueFunction, descriptionFunction, implementation) {
    let categories = await ImporterUtils.getCategories(csvs, name, valueFunction, descriptionFunction);
    if (categories) return await Importer.importPhenotype(name, about, categories, author, implementation);
    else return false;
  }

  static async importPhenotype(name, about, categories, userName, implementation="code", list=null) {

    const NAME = ImporterUtils.clean(sanitizeHtml(name));
    const ABOUT = sanitizeHtml(about).replace("&amp;", "and");
    const OUTPUT_EXTENSION = "csv";
    let workflowId, language;

    // Disc
    let steps=[];
    let existingWorkflowId = await Importer.existingWorkflow(NAME, ABOUT, userName, "read-potential-cases-disc");
    workflowId = (existingWorkflowId||await Importer.createWorkflow(NAME, ABOUT, userName));
    if (!workflowId) return res.status(500).send("Error creating workflow");
    language = "python";
    
    // Add data read
    try {
      steps.push(await Importer.getStep("read-potential-cases-disc", "Read potential cases from disc", "load", 1, "Potential cases of " + NAME, "Initial potential cases, read from disc.", OUTPUT_EXTENSION, [{"fileName":"read-potential-cases.py", "language":language, "implementationTemplatePath":"templates/read-potential-cases-disc.py", "substitutions":{"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())}}, {"fileName":"read-potential-cases.js", "language":"js", "implementationTemplatePath":"templates/read-potential-cases-disc.js", "substitutions":{"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())}}]));
    } catch(error) {
      logger.debug("Error creating first step from import: " + error);
      return false;
    }

    try {
      if(!list) {
        steps = steps.concat(await Importer.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName));
      } else {
        steps = steps.concat(await Importer.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, list, userName));
      }
    } catch(error) {
      logger.debug("Error creating workflow steps: " + error);
      return false;
    }

    let existingWorkflowChanged = await Importer.importChangesExistingWorkflow(existingWorkflowId, steps);
    if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) { 
      if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);
      await Importer.createSteps(workflowId, steps);
      await WorkflowUtils.workflowComplete(workflowId);
    }
    
    // i2b2
    steps = [];
    existingWorkflowId = await Importer.existingWorkflow(NAME, ABOUT, userName, "read-potential-cases-i2b2");
    
    workflowId = (existingWorkflowId||await Importer.createWorkflow(NAME, ABOUT, userName));
    if(!workflowId) return false;
    language = "js";

    // Add data read (i2b2)
    try {
      steps.push(await Importer.getStep("read-potential-cases-i2b2", "Read potential cases from i2b2", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from i2b2.", OUTPUT_EXTENSION, [{"fileName":"read-potential-cases-i2b2.js", "language":language, "implementationTemplatePath":"templates/read-potential-cases-i2b2.js", "substitutions":{"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())}}]));
    } catch(error) {
      logger.debug("Error creating first step from import: " + error);
      return false;
    }

    language = "python";
    try {
      if(!list) {
        steps = steps.concat(await Importer.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName));
      } else {
        steps = steps.concat(await Importer.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, list, userName));
      }
    } catch(error) {
      logger.debug("Error creating workflow steps (i2b2): " + error);
      return false;
    }

    existingWorkflowChanged = await Importer.importChangesExistingWorkflow(existingWorkflowId, steps);
    if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) { 
      if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);
      await Importer.createSteps(workflowId, steps);
      await WorkflowUtils.workflowComplete(workflowId);
    }

    // omop
    steps = [];
    existingWorkflowId = await Importer.existingWorkflow(NAME, ABOUT, userName, "read-potential-cases-omop");
    if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);

    workflowId = (existingWorkflowId||await Importer.createWorkflow(NAME, ABOUT, userName));
    if(!workflowId) return false;
    language = "js";

    // Add data read (omop)
    try {
      steps.push(await Importer.getStep("read-potential-cases-omop", "Read potential cases from an OMOP db.", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from an OMOP DB.", OUTPUT_EXTENSION, [{"fileName":"read-potential-cases-omop.js", "language":language, "implementationTemplatePath":"templates/read-potential-cases-omop.js", "substitutions":{"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())}}]));
    } catch(error) {
      logger.debug("Error creating first step from import: " + error);
      return false;
    }

    language = "python";
    try {
      if(!list) {
        steps = steps.concat(await Importer.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName));
      } else {
        steps = steps.concat(await Importer.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, list, userName));
      }
    } catch(error) {
      logger.debug("Error creating workflow steps (omop): " + error);
      return false;
    }

    existingWorkflowChanged = await Importer.importChangesExistingWorkflow(existingWorkflowId, steps);
    if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) { 
      if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);
      await Importer.createSteps(workflowId, steps);
      await WorkflowUtils.workflowComplete(workflowId);
    }

    // fhir
    steps = [];
    existingWorkflowId = await Importer.existingWorkflow(NAME, ABOUT, userName, "read-potential-cases-fhir");
    if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);

    workflowId = (existingWorkflowId||await Importer.createWorkflow(NAME, ABOUT, userName));
    if(!workflowId) return false;
    language = "js";

    // Add data read (fhir)
    try {
      steps.push(await Importer.getStep("read-potential-cases-fhir", "Read potential cases from a FHIR server.", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from a FHIR server.", OUTPUT_EXTENSION, [{"fileName":"read-potential-cases-fhir.js", "language":language, "implementationTemplatePath":"templates/read-potential-cases-fhir.js", "substitutions":{"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())}}]));
    } catch(error) {
      logger.debug("Error creating first step from import: " + error);
      return false;
    }

    language = "python";
    try {
      if(!list) {
        steps = steps.concat(await Importer.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName));
      } else {
        steps = steps.concat(await Importer.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, list, userName));
      }
    } catch(error) {
      logger.debug("Error creating workflow steps (fhir): " + error);
      return false;
    }

    existingWorkflowChanged = await Importer.importChangesExistingWorkflow(existingWorkflowId, steps);
    if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) { 
      if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);
      await Importer.createSteps(workflowId, steps);
      await WorkflowUtils.workflowComplete(workflowId);
    }

    return true;
  }

  static async importChangesExistingWorkflow(workflowId, steps) {
    if(!workflowId|!steps) return false;
    let existingSteps = await models.step.findAll({where:{workflowId:workflowId}});
    if(existingSteps.length!=steps.length) return true;
    steps = steps.sort((a, b)=>a.position-b.position);
    existingSteps = existingSteps.sort((a, b)=>a.position-b.position);
    for(let step in steps) {
      if(steps[step].stepName!=existingSteps[step].name) return true;
      if(steps[step].stepDoc!=existingSteps[step].doc) return true;
      if(steps[step].stepType!=existingSteps[step].type) return true;
      let existingInput = await models.input.findOne({where:{stepId:existingSteps[step].id}});
      let existingOutput = await models.output.findOne({where:{stepId:existingSteps[step].id}});
      let existingImplementation = await models.implementation.findOne({where:{stepId:existingSteps[step].id}});
      if(steps[step].inputDoc!=existingInput.doc) return true;
      if(steps[step].outputDoc!=existingOutput.doc) return true;
      for(let implementation of steps[step].implementations) {
        if(implementation.outputExtension!=existingOutput.extension) return true;
        if(implementation.fileName!=existingImplementation.fileName) return true;
        if(implementation.language!=existingImplementation.language) return true;
        const destination = "uploads/" + workflowId + "/" + existingImplementation.language;
        let storedImplementation = await fs.readFile(destination+"/"+existingImplementation.fileName, "utf8");
        if(implementation.implementationTemplate!=storedImplementation) return true;
      }
    }
    return false;
  }

  static async existingWorkflow(name, about, userName, connectorStepName="") {
    try {
      let workflows = await models.workflow.findAll({where: {name:name, about:about, userName:sanitizeHtml(userName)}});
      if(workflows.length) {
        if(workflows.length>4) throw "More than one match when checking for existing workflows.";
        for(let workflow of workflows) {
          try {
            let steps = await models.step.findAll({where:{workflowId:workflow.id}});
            if(!connectorStepName||steps.map((step)=>step.name).includes(connectorStepName)) {
              return workflow.id;
            }
          } catch(error) {
            logger.error("Unable to check for existing steps:"+error);
          }
        }
      }
    } catch(error) {
      logger.error("Unable to check for existing workflow: "+error);
    }
    return false;
  }

  static async getWorkflowStepsFromList(name, outputExtension, list, userName, position=2) {
    return (await Importer.getGroupedWorkflowStepsFromList(name, outputExtension, list, userName, position)).flat();
  }

  static async getGroupedWorkflowStepsFromList(name, outputExtension, list, userName, position=2) {
    
    let steps=[], positionToFileCategory={};

    for(let item of list) {
      if(item.logicType=="codelist") {
        let codeSteps = await Importer.getCodeWorkflowSteps(name, item.language, outputExtension, userName, item.categories, position, item.requiredCodes);
        if(item.fileCategory) for(let currentPosition=position; currentPosition<position+codeSteps.length; currentPosition++) if(item.fileCategory.length) positionToFileCategory[currentPosition] = item.fileCategory;
        position+=codeSteps.length;
        steps.push(codeSteps);
      } else if(item.logicType=="keywordlist") {
        let keywordSteps = await Importer.getKeywordWorkflowSteps(name, item.language, outputExtension, userName, item.categories, position);
        position+=keywordSteps.length;
        steps.push(keywordSteps);
      } else if(item.logicType=="age") {
        let stepShort = "age between " + item.ageLower + " and " + item.ageUpper + " yo";
        let stepName = ImporterUtils.clean(stepShort);
        let stepDoc = "Age of patient is between " + item.ageLower + " and " + item.ageUpper;
        let stepType = "logic";
        let inputDoc = "Potential cases of " + name;
        let outputDoc = "Patients who are between " + item.ageLower + " and " + item.ageUpper + " years old.";
        let fileName = ImporterUtils.clean(stepShort) + ".py";

        try {
          let step = await Importer.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":fileName, "language":item.language, "implementationTemplatePath":"templates/age.py", "substitutions":{"PHENOTYPE":ImporterUtils.clean(name.toLowerCase()), "AGE_LOWER":item.ageLower, "AGE_UPPER":item.ageUpper, "AUTHOR":userName, "YEAR":new Date().getFullYear()}}]);
          steps.push([step]);
        } catch(error) {
          error = "Error creating imported step (" + stepName + "): " + error;
          throw error;
        }
        position++;
      } else if(item.logicType=="codelistExclude") {
        let codeSteps = await Importer.getCodeWorkflowSteps(name, item.language, outputExtension, userName, item.categoriesExclude, position, item.requiredCodes, true);
        position+=codeSteps.length;
        steps.push(codeSteps);
      } else if(item.logicType=="lastEncounter") {
        let stepShort = "last encounter not greater than " + item.maxYears + " years";
        let stepName = ImporterUtils.clean(stepShort);
        let stepDoc = "Last interaction with patient is not more than " + item.maxYears + " years ago";
        let stepType = "logic";
        let inputDoc = "Potential cases of " + name;
        let outputDoc = "Patients with an encounter less than " + item.maxYears + " years ago.";
        let fileName = ImporterUtils.clean(stepShort) + ".py";

        try {
          let step = await Importer.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":fileName, "language":item.language, "implementationTemplatePath":"templates/last-encounter.py", "substitutions":{"PHENOTYPE":ImporterUtils.clean(name.toLowerCase()), "MAX_YEARS":item.maxYears, "AUTHOR":userName, "YEAR":new Date().getFullYear()}}]);
          steps.push([step]);
        } catch(error) {
          error = "Error creating imported step (" + stepName + "): " + error;
          throw error;
        }
        position++;
      } else if(item.logicType=="codelistsTemporal") {
        let temporalSteps = [];
        // Compare each 'after' category to the single 'before' code list in 'days after' relationship 
        for(let categoryAfter in item.categoriesAfter) {
          let stepShort = ImporterUtils.clean(categoryAfter.toLowerCase())+" "+item.minDays+" to "+item.maxDays+" days after "+ImporterUtils.clean(item.nameBefore.toLowerCase());
          let stepName = ImporterUtils.clean(stepShort);
          let categoryAfterCleaned = ImporterUtils.clean(categoryAfter, true);
          let stepDoc = "Diagnosis of "+(categoryAfterCleaned.substr(0, categoryAfterCleaned.lastIndexOf("-"))+ "("+categoryAfterCleaned.substr(categoryAfterCleaned.lastIndexOf("-")+2)+")")+" between "+item.minDays+" and "+item.maxDays+" days after a diagnosis of "+ImporterUtils.clean(item.nameBefore, true);
          let stepType = "logic";
          let inputDoc = "Potential cases of "+name;
          let outputDoc = "Patients with clinical codes indicating "+name+" related events in electronic health record.";
          let fileName = ImporterUtils.clean(stepShort) + ".py";

          try {
            let step = await Importer.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":fileName, "language":item.language, "implementationTemplatePath":"templates/codelists-temporal.py", "substitutions":{"PHENOTYPE":ImporterUtils.clean(name.toLowerCase()), "LIST_BEFORE":item.codesBefore, "LIST_AFTER":"\""+item.categoriesAfter[categoryAfter].join('","')+"\"", "MIN_DAYS":item.minDays, "MAX_DAYS": item.maxDays, "CATEGORY":stepName, "AUTHOR":userName, "YEAR":new Date().getFullYear()}}]);
            temporalSteps.push(step);
          } catch(error) {
            error = "Error creating imported step (" + stepName + "): " + error;
            throw error;
          }
          position++;
          
        }
        steps.push(temporalSteps);
      } else if(item.logicType=="branch") {
        let stepShort = ImporterUtils.clean(item.nestedWorkflowName).toLowerCase();
        let stepName = stepShort;
        let stepDoc = item.nestedWorkflowName.split("-").join(" ");
        stepDoc = stepDoc.charAt(0).toUpperCase()+stepDoc.substring(1);
        let stepType = "logic";
        let inputDoc = "Potential cases of "+name;
        let outputDoc = "Patients with logic indicating "+name+" related events in electronic health record.";

        try {
          let step = await Importer.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":item.nestedWorkflowId, "language":"", "implementationTempaltePath":"", "substitutions":{}}]);
          steps.push([step]);
        } catch(error) {
          error = "Error creating imported step (" + stepName + "): " + error;
          throw error;
        }
        position++;
        
      }
    }

    if(steps.flat().filter(({stepName}, index)=>!steps.flat().map(step=>step.stepName).includes(stepName, index+1)).length!=steps.flat().length) steps = steps.flat().map(function(step) {
      let replacementStepName = Object.keys(positionToFileCategory).includes(step.position.toString())?step.stepName.split("---")[0]+"-"+positionToFileCategory[step.position]+"---"+step.stepName.split("---")[1]:step.stepName;
      let replacementStepDoc = Object.keys(positionToFileCategory).includes(step.position.toString())?step.stepDoc.split(" - ")[0]+" "+positionToFileCategory[step.position]+" - "+step.stepDoc.split(" - ")[1]:step.stepDoc;
      Object.assign(step, {"stepName":replacementStepName});
      Object.assign(step, {"fileName":replacementStepName+".py"});
      Object.assign(step, {"stepDoc":replacementStepDoc});
      return step;
    });

    steps.push([await Importer.getFileWrite(position, name, outputExtension, "python")]);

    return steps;
    
  }

  static async getFileWrite(position, name, outputExtension, language) {
    try {
      return await Importer.getStep("output-cases", "Output cases", "output", position, "Potential cases of " + name, "Output containing patients flagged as having this type of " + name, outputExtension, [{"fileName":"output-cases.py", "language":language, "implementationTemplatePath":"templates/output-cases.py", "substitutions":{"PHENOTYPE":ImporterUtils.clean(name.toLowerCase())}}]);
    } catch(error) {
      error = "Error creating last step from import: " + error;
      throw error;
    }
  }

  static async getKeywordWorkflowSteps(name, language, outputExtension, userName, categories, position=2) {
    return await Importer.getCategoryWorkflowSteps(name, language, outputExtension, userName, categories, "keywords", "templates/keywords.py", position);
  }

  static async getCodeWorkflowSteps(name, language, outputExtension, userName, categories, position=2, requiredCodes=1, exclude=false) {
    return await Importer.getCategoryWorkflowSteps(name, language, outputExtension, userName, categories, "clinical codes", exclude?"templates/codelist-exclude.py":"templates/codelist.py", position, requiredCodes, exclude);
  }

  static async getCategoryWorkflowSteps(name, language, outputExtension, userName, categories, categoryType, template, position=2, requiredCodes=1, exclude=false) {

    let steps=[];

    // For each code set
    for(var category in categories) {
      let stepName = ImporterUtils.clean(category.toLowerCase()+(requiredCodes>1?" "+requiredCodes:"")+(exclude?" exclude":""));
      let stepDoc = (exclude?"Exclude ":"Identify ")+ImporterUtils.clean(category, true)+(requiredCodes>1?" ("+requiredCodes+ " instances)":"");
      let stepType = "logic";
      let inputDoc = "Potential cases of "+name;
      let outputDoc = (exclude?"Excluded patients":"Patients")+" with "+categoryType+" indicating "+name+" related events in electronic health record.";
      let fileName = ImporterUtils.clean(category.toLowerCase())+".py";

      try {
        steps.push(await Importer.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":(exclude?"exclude-":"")+fileName, "language":language, "implementationTemplatePath":template, "substitutions":{"PHENOTYPE":name.toLowerCase().replace(/ /g, "-"), "CATEGORY":ImporterUtils.clean(category.toLowerCase()), "LIST":'"'+categories[category].join('","')+'"', "REQUIRED_CODES":requiredCodes, "AUTHOR":userName, "YEAR":new Date().getFullYear()}}]));
      } catch(error) {
        error = "Error creating imported step (" + stepName + "): " + error;
        throw error;
      }

      position++;
    }

    return steps;

  }

  static async getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, implementations) {
    
    for(let implementation in implementations) {
      let implementationTemplate = implementations[implementation].implementationTemplatePath?await fs.readFile(implementations[implementation].implementationTemplatePath, "utf8"):implementations[implementation].implementationTemplate;
      implementationTemplate = ImporterUtils.templateReplace(implementationTemplate, implementations[implementation].substitutions);
      implementations[implementation].implementationTemplate = implementationTemplate;
    }
    return {stepName:stepName, stepDoc:stepDoc, stepType:stepType, position:position, inputDoc:inputDoc, outputDoc:outputDoc, outputExtension:outputExtension, implementations:implementations};

  }

  static async createSteps(workflowId, steps) {

    let step;
    if(steps.map(step=>step.stepName).length!=new Set(steps.map(step=>step.stepName)).size) throw "Duplicate steps found during import: " + JSON.stringify(steps.map(step=>step.stepName));

    for(let stepData of steps) {
      try {
        step = await models.step.create({name:stepData.stepName, doc:stepData.stepDoc, type:stepData.stepType, workflowId:workflowId, position:stepData.position});
      } catch(error) {
        error = "Error importing step: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        throw error;
      }
    
      try {
        await models.input.create({doc:stepData.inputDoc, stepId:step.id});
      } catch(error) {
        error = "Error importing step input: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        throw error;
      }
    
      try {
        await models.output.create({doc:stepData.outputDoc, extension:stepData.outputExtension, stepId:step.id});
      } catch(error) {
        error = "Error importing step output: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
        logger.debug(error);
        throw error;
      }
      
      for(let implementation of stepData.implementations) {
        try {
          await models.implementation.upsert({fileName:implementation.fileName, language:implementation.language, stepId:step.id});
        } catch(error) {
          error = "Error creating step implementation: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
          logger.debug(error);
          throw error;
        }
        
        if(implementation.language&&implementation.implementationTemplate) {
          const destination = "uploads/" + workflowId + "/" + implementation.language;
        
          try {
            await fs.stat(destination);
          } catch(error) {
            await fs.mkdir(destination, {recursive:true});
          }
          fs.writeFile(destination + "/" + implementation.fileName.replace(/\//g, ""), implementation.implementationTemplate);
        }
      }
    }

  }

  static async createWorkflow(name, about, userName) {
    try {
      var workflow = await models.workflow.create({name:name, about:about, userName:sanitizeHtml(userName)});
      return workflow.id;
    } catch(error) {
      error = "Error creating workflow for CSV: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
      logger.debug(error);
      return false;
    }
  }

}

//

router.post('/caliber/annotate', async function(req, res, next) {

  if(!req.body.markdown||!req.body.name||!req.body.about) {
    logger.debug("Missing params.");
    return res.status(500).send("Missing params.");
  }

  try {
    var phenotypes = await models.workflow.findAll({where:{complete:true, name:{[op.like]:"%"+req.body.name+"%"}, about:{[op.like]:"%"+req.body.about+"%"}, [op.and]:[{'$parent.child.workflowId$':null}, {'$parent.child.parentId$':null}]}, include:[{model:models.workflow, as:"parent", required:false}], order:[['name', 'ASC']]})
  } catch(error) {
    logger.error(error.message);
  }
  let markdowns = [];

  if(!phenotypes) res.sendStatus(500);
  
  for(let phenotype of phenotypes) {

    var lastHeading="";
    let updatedContent="";
    const BUTTON_HTML = '<button type="button" class="btn btn-sm"><a href="https://kclhi.org/phenoflow/phenotype/download/'+phenotype.id+'">Phenoflow implementation</a></button>\n';

    for(let line of req.body.markdown.content.split("\n")) {
      if(lastHeading.includes("Implementation")&&line.startsWith("#")) updatedContent += BUTTON_HTML;
      if(line.startsWith("#")) lastHeading=line;
      updatedContent+=line+"\n";
    }

    req.body.markdown.content = updatedContent.substring(1, updatedContent.length-1);
    // Markdown output
    let markdown = "";
    markdown+="---\n";

    for(let [key, value] of Object.entries(req.body.markdown)) {
      if(!value) continue;
      if(key=="content") {
        markdown+="---\n";
        markdown+=value?value:"";
        break;
      }
      if(Array.isArray(value)) {
        markdown+=key+": \n";
        for(let markdownArrayItem of value) markdown+="    - "+(key=="publications"?"'":"")+markdownArrayItem+(key=="publications"?"' ":"")+"\n";
      } else {
        if(key.includes("date")&&value.includes("T")) value=value.split("T")[0]
        markdown+=key+": "+(value?value+(key=="phenotype_id"?" ":""):"")+"\n";
      }
    }

    if(!markdown.includes("phenoflow")) {
      if(!lastHeading.includes("Implementation")) {
        markdown += "\n" + "### Implementation" + "\n" + BUTTON_HTML;
      } else {
        markdown += "\n" + BUTTON_HTML;
      }
    } 
    markdowns.push(markdown);
  }

  res.send({"markdowns":markdowns});
});

module.exports = router;
