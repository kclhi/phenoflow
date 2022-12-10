const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');
const AdmZip = require('adm-zip');
const parse = require('neat-csv');
const { v1: uuidv1 } = require("uuid");

const ParserUtils = require("../util/parser");

/**
 * @swagger
 * /phenoflow/parser/parseCodelists:
 *   post:
 *     summary: Parse a set of codelists
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
 *         description: Parsed codelist.
 */
router.post('/parseCodelists', async function(req, res, next) {
  req.setTimeout(0);
  if(req.files&&req.files.csvs) {
    let zip;
    try { 
      zip = new AdmZip(req.files.csvs.data);
    } catch(zipError) { 
      logger.error("ZIP error: "+zipError);
      return res.send(zipError.message).status(500);
    }
    req.body.csvs = [];
    for(let entry of zip.getEntries()) req.body.csvs.push({"filename":entry.entryName, "content":await parse(entry.getData().toString())});
    let uniqueCSVs = req.body.csvs.filter(({filename}, index)=>!req.body.csvs.map(csv=>csv.filename).includes(filename, index+1));
    req.body.about = req.body.about+" - "+ParserUtils.hash(uniqueCSVs.map(csv=>csv.content));
  }
  if(!req.body.csvs||!req.body.name||!req.body.about||!req.body.userName) res.status(500).send("Missing params.");
  try {
    let generatedWorkflows = await Parser.parseLists(req.body.csvs, req.body.name, req.body.about, req.body.userName, ParserUtils.getValue, ParserUtils.getDescription, "code");
    if(generatedWorkflows) return res.send(generatedWorkflows).status(200);
    else return res.sendStatus(500);
  } catch(importListsError) {
    logger.error("Import list error:" +importListsError);
    return res.sendStatus(500);
  }
});

/**
 * @swagger
 * /phenoflow/parser/parseKeywordList:
 *   post:
 *     summary: Parse a list of keywords
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
 *         description: Parsed keyword list
 */

router.post('/parseKeywordList', async function(req, res, next) {
  req.setTimeout(0);
  if(req.files&&req.files.keywords) {
    req.body.keywords = {"filename":req.files.keywords.name, "content":await parse(req.files.keywords.data.toString())};
    req.body.about = req.body.about+" - "+ParserUtils.hash(req.body.keywords.content);
  }
  if(!req.body.keywords||!req.body.name||!req.body.about||!req.body.userName) res.status(500).send("Missing params.");
  function getValue(row) {
    if(row["keyword"]) return row["keyword"].replace(/\\\\b/g, "");
    return 0;
  }
  function getDescription(row) {
    let description = row["keyword"].replace(/\\\\b/g, "");
    if(description&&description.includes(" ")) description=description.split(" ").filter(word=>!ParserUtils.ignoreInStepName(ParserUtils.clean(word))).join(" ");
    return description;
  }
  
  let generatedWorkflows = await Parser.parseLists([req.body.keywords], req.body.name, req.body.about, req.body.userName, getValue, getDescription, "keywords");
  if(generatedWorkflows) return res.send(generatedWorkflows).status(200);
  else return res.sendStatus(500);
});

/**
 * @swagger
 * /phenoflow/parser/parseSteplist:
 *   post:
 *     security:
 *       - bearerAuth: []
 *     summary: Parse a steplist
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
 *         description: Parsed steplist
 */

router.post('/parseSteplist', async function(req, res, next) {
  req.setTimeout(0);
  if(req.files&&req.files.steplist&&req.files.csvs) {
    req.body.steplist = {"filename":req.files.steplist.name, "content":await parse(req.files.steplist.data.toString())};
    let zip;
    try { 
      zip = new AdmZip(req.files.csvs.data);
    } catch(zipError) { 
      logger.error("ZIP error: "+zipError);
      return res.status(500).send(zipError.message);
    }
    req.body.csvs = [];
    for(let entry of zip.getEntries()) req.body.csvs.push({"filename":entry.entryName, "content":await parse(entry.getData().toString())});
    let id = await ParserUtils.steplistHash(req.body.steplist, req.body.csvs);
    req.body.about = req.body.about+" - "+id;
  }
  if(!req.body.steplist||!req.body.name||!req.body.about||!req.body.userName||!req.body.csvs) res.status(500).send("Missing params.");
  let uniqueCSVs = req.body.csvs.filter(({filename}, index)=>!req.body.csvs.map(csv=>csv.filename).includes(filename, index+1));
  try {
    var [ list, nestedGeneratedWorkflows ] = await Parser.getSteplist(req.body.steplist, uniqueCSVs, req.body.name, req.body.userName);
  } catch(getStepListError) {
    logger.error("Get steplist error: "+getStepListError);
    return res.sendStatus(500);
  }
  try {
    let generatedWorkflows = await Parser.parsePhenotype(req.body.name, req.body.about, null, req.body.userName, null, list);
    if(generatedWorkflows) {
      generatedWorkflows = generatedWorkflows.concat(nestedGeneratedWorkflows);
      return res.send(generatedWorkflows).status(200);
    }
    else { 
      return res.sendStatus(500); 
    }
  } catch(importPhenotypeError) {
    logger.error("Import phenotype error: "+importPhenotypeError);
    return res.sendStatus(500);
  }
});

router.post('/parseStep', async function(req, res, next) {
  req.setTimeout(0);
  if(!req.body.name||!req.body.doc||!req.body.type||!req.body.position||!req.body.inputDoc||!req.body.outputDoc||!req.body.outputExtensions||!req.body.implementations) res.status(500).send("Missing params.");
  try {
    let step = await Parser.getStep(req.body.name, req.body.doc, req.body.type, req.body.position, req.body.inputDoc, req.body.outputDoc, req.body.outputExtensions, req.body.implementations)
    if(step) {
      console.log(JSON.stringify(step));
      return res.send(step).status(200);
    }
    else { 
      return res.sendStatus(500); 
    }
  } catch(parseStepError) {
    logger.error("Parse step error: "+parseStepError);
    return res.sendStatus(500);
  }
});

//

class Parser {

  static async getSteplist(steplist, csvs, name, userName) {
    let list=[], nestedWorkflows=[];
    for(let row of steplist.content) {
      if(row["logicType"]=="codelist") {
        let file = row["param"].split(":")[0];
        let requiredCodes = row["param"].split(":")[1];
        let categories = ParserUtils.getCategories([csvs.filter((csv)=>csv.filename==file)[0]], ParserUtils.clean(name.toLowerCase())==ParserUtils.clean(ParserUtils.getName(file).toLowerCase())?name:ParserUtils.getName(file));
        // Prepare additional terms to differentiate categories, if as a part of a steplist the same categories are identified for different lists
        let fileCategory = ParserUtils.getFileCategory(csvs.filter((csv)=>csv.filename==file)[0].content, name);
        list.push({"logicType":"codelist", "language":"python", "categories":categories, "requiredCodes":requiredCodes, "fileCategory":fileCategory});
      } else if(row["logicType"]=="codelistExclude") {
        let file = row["param"].split(":")[0];
        let categoriesExclude = ParserUtils.getCategories([csvs.filter((csv)=>csv.filename==file)[0]], ParserUtils.getName(row["param"]));
        list.push({"logicType":"codelistExclude", "language":"python", "categoriesExclude":categoriesExclude});
      } else if(row["logicType"]=="age") {
        list.push({"logicType":"age", "language":"python", "ageLower":row["param"].split(":")[0], "ageUpper":row["param"].split(":")[1]});
      } else if(row["logicType"]=="lastEncounter") {
        list.push({"logicType":"lastEncounter", "language":"python", "maxYears":row["param"]});
      } else if(row["logicType"]=="codelistsTemporal") {
        let fileBefore = row["param"].split(":")[0];
        let fileAfter = row["param"].split(":")[1];
        let csv = csvs.filter((csv)=>csv.filename==fileBefore)[0];
        let codesBefore = [...new Set(csv.content.map((row)=>"{\"code\":\""+ParserUtils.getValue(ParserUtils.cleanCSVHeaders(row))+"\",\"system\":\""+ParserUtils.getCodingSystem(csv)+"\"}"))];
        let categoriesAfter = ParserUtils.getCategories([csvs.filter((csv)=>csv.filename==fileAfter)[0]], ParserUtils.getName(fileAfter));
        let minDays = row["param"].split(":")[2];
        let maxDays = row["param"].split(":")[3];
        list.push({"logicType":"codelistsTemporal", "language":"python", "nameBefore":ParserUtils.getName(fileBefore), "codesBefore":codesBefore, "categoriesAfter":categoriesAfter, "minDays":minDays, "maxDays":maxDays});
      } else if(row["logicType"]=="branch") {
        let nestedSteplist = csvs.filter(csv=>csv.filename==row["param"])[0];
        // While getting our steplist we may also generate (nested) nested workflows. Store these.
        let [branchList, branchNestedWorkflows] = await Parser.getSteplist(nestedSteplist, csvs, name, userName);
        nestedWorkflows = nestedWorkflows.concat(branchNestedWorkflows);
        let nestedWorkflowName = ParserUtils.summariseSteplist(nestedSteplist);
        let id = ParserUtils.steplistHash(nestedSteplist, csvs);
        let nestedWorkflow = await Parser.parseNestedPhenotype(name, nestedWorkflowName, nestedWorkflowName.charAt(0).toUpperCase()+nestedWorkflowName.substring(1)+' - '+id, userName, branchList);
        nestedWorkflows.push(nestedWorkflow);
        list.push({"logicType":"branch", "nestedWorkflowName":nestedWorkflowName, "nestedWorkflowId":nestedWorkflow.id});
      }
    }
    return [list, nestedWorkflows];
  }

  static async parseNestedPhenotype(name, parentStepName, about, userName, list) {
    const OUTPUT_EXTENSION = "csv";
    let steps = await Parser.getGroupedWorkflowStepsFromList(name, OUTPUT_EXTENSION, list, userName, 1);
    steps.pop();
    steps.push(await this.getOutputCasesConditional(steps.flat().length+1, name, OUTPUT_EXTENSION, "python", parentStepName, steps));
    steps = steps.flat();
    let workflow = Parser.createWorkflow(ParserUtils.clean(name), about, userName);
    return {...workflow, steps};
  }

  static async getOutputCasesConditional(position, name, outputExtension, language, parentStepName, steps) { 
    let stepName = "output-"+ParserUtils.clean(parentStepName).toLowerCase()+"-cases";
    let fileName = stepName+".py";
    try {
      return await Parser.getStep(stepName, "Output cases", "output", position, "Potential cases of " + name, "Output containing patients flagged as having this type of " + name, outputExtension, [{"fileName":fileName, "language":language, "implementationTemplatePath":"templates/output-codelist-multiple.py", "substitutions":{"PHENOTYPE":ParserUtils.clean(name.toLowerCase()), "NESTED":ParserUtils.clean(parentStepName.toLowerCase()), "CASES":JSON.stringify(steps.filter(steps=>steps.filter(step=>!step.stepDoc.startsWith("Exclude")).length==steps.length).map(steps=>steps.map(step=>step.stepName+"-identified")))}}]);
    } catch(error) {
      error = "Error creating output conditional for nested step from import: " + error;
      throw error;
    }
  }

  static async parseLists(csvs, name, about, author, valueFunction, descriptionFunction, implementation) {
    let categories = await ParserUtils.getCategories(csvs, name, valueFunction, descriptionFunction);
    if (categories) return await Parser.parsePhenotype(name, about, categories, author, implementation);
    else return false;
  }

  static async parsePhenotype(name, about, categories, userName, implementation="code", list=null) {

    const NAME =  ParserUtils.clean(sanitizeHtml(name));
    const ABOUT = sanitizeHtml(about).replace("&amp;", "and");
    const OUTPUT_EXTENSION = "csv";
    let generatedWorkflows=[];

    // Disc
    let steps=[];
    let discWorkflow = Parser.createWorkflow(NAME, ABOUT, userName);
    if (!discWorkflow) return res.status(500).send("Error creating workflow");
    let language = "python";
    
    // Add data read
    steps.push(await Parser.getStep("read-potential-cases-disc", "Read potential cases from disc", "load", 1, "Potential cases of " + NAME, "Initial potential cases, read from disc.", OUTPUT_EXTENSION, [{"fileName":"read-potential-cases.py", "language":language, "implementationTemplatePath":"templates/read-potential-cases-disc.py", "substitutions":{"PHENOTYPE":ParserUtils.clean(NAME.toLowerCase())}}, {"fileName":"read-potential-cases.js", "language":"js", "implementationTemplatePath":"templates/read-potential-cases-disc.js", "substitutions":{"PHENOTYPE":ParserUtils.clean(NAME.toLowerCase())}}]));

    if(!list) {
      steps = steps.concat(await Parser.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName));
    } else {
      steps = steps.concat(await Parser.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, list, userName));
    }

    generatedWorkflows.push({...discWorkflow, steps});

    // i2b2
    steps = [];
    let i2b2Workflow = Parser.createWorkflow(NAME, ABOUT, userName);
    if (!i2b2Workflow) return res.status(500).send("Error creating workflow");
    language = "js";

    // Add data read (i2b2)
    steps.push(await Parser.getStep("read-potential-cases-i2b2", "Read potential cases from i2b2", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from i2b2.", OUTPUT_EXTENSION, [{"fileName":"read-potential-cases-i2b2.js", "language":language, "implementationTemplatePath":"templates/read-potential-cases-i2b2.js", "substitutions":{"PHENOTYPE":ParserUtils.clean(NAME.toLowerCase())}}]));

    language = "python";

    if(!list) {
      steps = steps.concat(await Parser.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName));
    } else {
      steps = steps.concat(await Parser.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, list, userName));
    }

    generatedWorkflows.push({...i2b2Workflow, steps});

    // omop
    steps = [];
    let omopWorkflow = Parser.createWorkflow(NAME, ABOUT, userName);
    if (!omopWorkflow) return res.status(500).send("Error creating workflow");
    language = "js";

    // Add data read (omop)
    steps.push(await Parser.getStep("read-potential-cases-omop", "Read potential cases from an OMOP db.", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from an OMOP DB.", OUTPUT_EXTENSION, [{"fileName":"read-potential-cases-omop.js", "language":language, "implementationTemplatePath":"templates/read-potential-cases-omop.js", "substitutions":{"PHENOTYPE":ParserUtils.clean(NAME.toLowerCase())}}]));

    language = "python";
 
    if(!list) {
      steps = steps.concat(await Parser.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName));
    } else {
      steps = steps.concat(await Parser.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, list, userName));
    }

    generatedWorkflows.push({...omopWorkflow, steps});

    // fhir
    steps = [];

    let fhirWorkflow = Parser.createWorkflow(NAME, ABOUT, userName);
    if (!fhirWorkflow) return res.status(500).send("Error creating workflow");
    language = "js";

    // Add data read (fhir)
    steps.push(await Parser.getStep("read-potential-cases-fhir", "Read potential cases from a FHIR server.", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from a FHIR server.", OUTPUT_EXTENSION, [{"fileName":"read-potential-cases-fhir.js", "language":language, "implementationTemplatePath":"templates/read-potential-cases-fhir.js", "substitutions":{"PHENOTYPE":ParserUtils.clean(NAME.toLowerCase())}}]));

    language = "python";
      
    if(!list) {
      steps = steps.concat(await Parser.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName));
    } else {
      steps = steps.concat(await Parser.getWorkflowStepsFromList(NAME, OUTPUT_EXTENSION, list, userName));
    }

    generatedWorkflows.push({...fhirWorkflow, steps});
    
    return generatedWorkflows;
  }

  static async getWorkflowStepsFromList(name, outputExtension, list, userName, position=2) {
    return (await Parser.getGroupedWorkflowStepsFromList(name, outputExtension, list, userName, position)).flat();
  }

  static async getGroupedWorkflowStepsFromList(name, outputExtension, list, userName, position=2) {
    
    let steps=[], positionToFileCategory={};

    for(let item of list) {
      if(item.logicType=="codelist") {
        let codeSteps = await Parser.getCodeWorkflowSteps(name, item.language, outputExtension, userName, item.categories, position, item.requiredCodes);
        if(item.fileCategory) for(let currentPosition=position; currentPosition<position+codeSteps.length; currentPosition++) if(item.fileCategory.length) positionToFileCategory[currentPosition] = item.fileCategory;
        position+=codeSteps.length;
        steps.push(codeSteps);
      } else if(item.logicType=="keywordlist") {
        let keywordSteps = await Parser.getKeywordWorkflowSteps(name, item.language, outputExtension, userName, item.categories, position);
        position+=keywordSteps.length;
        steps.push(keywordSteps);
      } else if(item.logicType=="age") {
        let stepShort = "age between " + item.ageLower + " and " + item.ageUpper + " yo";
        let stepName = ParserUtils.clean(stepShort);
        let stepDoc = "Age of patient is between " + item.ageLower + " and " + item.ageUpper;
        let stepType = "logic";
        let inputDoc = "Potential cases of " + name;
        let outputDoc = "Patients who are between " + item.ageLower + " and " + item.ageUpper + " years old.";
        let fileName = ParserUtils.clean(stepShort) + ".py";

        try {
          let step = await Parser.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":fileName, "language":item.language, "implementationTemplatePath":"templates/age.py", "substitutions":{"PHENOTYPE":ParserUtils.clean(name.toLowerCase()), "AGE_LOWER":item.ageLower, "AGE_UPPER":item.ageUpper, "AUTHOR":userName, "YEAR":new Date().getFullYear()}}]);
          steps.push([step]);
        } catch(error) {
          error = "Error creating imported step (" + stepName + "): " + error;
          throw error;
        }
        position++;
      } else if(item.logicType=="codelistExclude") {
        let codeSteps = await Parser.getCodeWorkflowSteps(name, item.language, outputExtension, userName, item.categoriesExclude, position, item.requiredCodes, true);
        position+=codeSteps.length;
        steps.push(codeSteps);
      } else if(item.logicType=="lastEncounter") {
        let stepShort = "last encounter not greater than " + item.maxYears + " years";
        let stepName = ParserUtils.clean(stepShort);
        let stepDoc = "Last interaction with patient is not more than " + item.maxYears + " years ago";
        let stepType = "logic";
        let inputDoc = "Potential cases of " + name;
        let outputDoc = "Patients with an encounter less than " + item.maxYears + " years ago.";
        let fileName = ParserUtils.clean(stepShort) + ".py";

        try {
          let step = await Parser.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":fileName, "language":item.language, "implementationTemplatePath":"templates/last-encounter.py", "substitutions":{"PHENOTYPE":ParserUtils.clean(name.toLowerCase()), "MAX_YEARS":item.maxYears, "AUTHOR":userName, "YEAR":new Date().getFullYear()}}]);
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
          let stepShort = ParserUtils.clean(categoryAfter.toLowerCase())+" "+item.minDays+" to "+item.maxDays+" days after "+ParserUtils.clean(item.nameBefore.toLowerCase());
          let stepName = ParserUtils.clean(stepShort);
          let categoryAfterCleaned = ParserUtils.clean(categoryAfter, true);
          let stepDoc = "Diagnosis of "+(categoryAfterCleaned.substr(0, categoryAfterCleaned.lastIndexOf("-"))+ "("+categoryAfterCleaned.substr(categoryAfterCleaned.lastIndexOf("-")+2)+")")+" between "+item.minDays+" and "+item.maxDays+" days after a diagnosis of "+ParserUtils.clean(item.nameBefore, true);
          let stepType = "logic";
          let inputDoc = "Potential cases of "+name;
          let outputDoc = "Patients with clinical codes indicating "+name+" related events in electronic health record.";
          let fileName = ParserUtils.clean(stepShort) + ".py";

          try {
            let step = await Parser.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":fileName, "language":item.language, "implementationTemplatePath":"templates/codelists-temporal.py", "substitutions":{"PHENOTYPE":ParserUtils.clean(name.toLowerCase()), "LIST_BEFORE":"["+item.codesBefore+"]", "LIST_AFTER":JSON.stringify(item.categoriesAfter[categoryAfter]), "MIN_DAYS":item.minDays, "MAX_DAYS": item.maxDays, "CATEGORY":stepName, "AUTHOR":userName, "YEAR":new Date().getFullYear()}}]);
            temporalSteps.push(step);
          } catch(error) {
            error = "Error creating imported step (" + stepName + "): " + error;
            throw error;
          }
          position++;
          
        }
        steps.push(temporalSteps);
      } else if(item.logicType=="branch") {
        let stepShort = ParserUtils.clean(item.nestedWorkflowName).toLowerCase();
        let stepName = stepShort;
        let stepDoc = item.nestedWorkflowName.split("-").join(" ");
        stepDoc = stepDoc.charAt(0).toUpperCase()+stepDoc.substring(1);
        let stepType = "logic";
        let inputDoc = "Potential cases of "+name;
        let outputDoc = "Patients with logic indicating "+name+" related events in electronic health record.";

        try {
          let step = await Parser.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":item.nestedWorkflowId, "language":"", "implementationTempaltePath":"", "substitutions":{}}]);
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

    steps.push([await Parser.getFileWrite(position, name, outputExtension, "python")]);

    return steps;
    
  }

  static async getFileWrite(position, name, outputExtension, language) {
    try {
      return await Parser.getStep("output-cases", "Output cases", "output", position, "Potential cases of " + name, "Output containing patients flagged as having this type of " + name, outputExtension, [{"fileName":"output-cases.py", "language":language, "implementationTemplatePath":"templates/output-cases.py", "substitutions":{"PHENOTYPE":ParserUtils.clean(name.toLowerCase())}}]);
    } catch(error) {
      error = "Error creating last step from import: " + error;
      throw error;
    }
  }

  static async getKeywordWorkflowSteps(name, language, outputExtension, userName, categories, position=2) {
    return await Parser.getCategoryWorkflowSteps(name, language, outputExtension, userName, categories, "keywords", "templates/keywords.py", position);
  }

  static async getCodeWorkflowSteps(name, language, outputExtension, userName, categories, position=2, requiredCodes=1, exclude=false) {
    return await Parser.getCategoryWorkflowSteps(name, language, outputExtension, userName, categories, "clinical codes", exclude?"templates/codelist-exclude.py":"templates/codelist.py", position, requiredCodes, exclude);
  }

  static async getCategoryWorkflowSteps(name, language, outputExtension, userName, categories, categoryType, template, position=2, requiredCodes=1, exclude=false) {

    let steps=[];

    // For each code set
    for(var category in categories) {
      let stepName = ParserUtils.clean(category.toLowerCase()+(requiredCodes>1?" "+requiredCodes:"")+(exclude?" exclude":""));
      let stepDoc = (exclude?"Exclude ":"Identify ")+ParserUtils.clean(category, true)+(requiredCodes>1?" ("+requiredCodes+ " instances)":"");
      let stepType = "logic";
      let inputDoc = "Potential cases of "+name;
      let outputDoc = (exclude?"Excluded patients":"Patients")+" with "+categoryType+" indicating "+name+" related events in electronic health record.";
      let fileName = ParserUtils.clean(category.toLowerCase())+".py";

      try {
        steps.push(await Parser.getStep(stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, [{"fileName":(exclude?"exclude-":"")+fileName, "language":language, "implementationTemplatePath":template, "substitutions":{"PHENOTYPE":name.toLowerCase().replace(/ /g, "-"), "CATEGORY":ParserUtils.clean(category.toLowerCase()), "LIST":JSON.stringify(categories[category]), "REQUIRED_CODES":requiredCodes, "AUTHOR":userName, "YEAR":new Date().getFullYear()}}]));
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
      implementationTemplate = ParserUtils.templateReplace(implementationTemplate, implementations[implementation].substitutions);
      implementations[implementation].implementationTemplate = implementationTemplate;
    }
    return {stepName:stepName, stepDoc:stepDoc, stepType:stepType, position:position, inputDoc:inputDoc, outputDoc:outputDoc, outputExtension:outputExtension, implementations:implementations};

  }

  static createWorkflow(name, about, userName) {
    try {
      return {id: uuidv1(), name:name, about:about, userName:sanitizeHtml(userName)};
    } catch(error) {
      logger.debug("Create workflow error: "+error);
      return false;
    }
  }

}

module.exports = router;
