const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sequelize = require('sequelize');
const op = sequelize.Op;
const jwt = require('express-jwt');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');

const config = require("config");
const WorkflowUtils = require("../util/workflow");
const ImporterUtils = require("../util/importer");

router.post('/importCodelists', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.body.csvs||!req.body.name||!req.body.about||!req.body.userName) res.status(500).send("Missing params.");
  if(await importLists(req.body.csvs, req.body.name, req.body.about, req.body.userName, ImporterUtils.getValue, ImporterUtils.getDescription, "code")) return res.sendStatus(200);
  else return res.sendStatus(500);
});

router.post('/importKeywordList', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
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
  
  if(await importLists([req.body.keywords], req.body.name, req.body.about, req.body.userName, getValue, getDescription, "keywords")) return res.sendStatus(200);
  else return res.sendStatus(500);
});

router.post('/importSteplist', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.body.steplist||!req.body.name||!req.body.about||!req.body.userName) res.status(500).send("Missing params.");
  let list=[];
  for(let row of req.body.steplist.content) {
    if(row["logicType"]=="codelist") {
      let file = row["param"].split(":")[0];
      let requiredCodes = row["param"].split(":")[1];
      let categories = ImporterUtils.getCategories(req.body.csvs.filter((csv)=>csv.filename==file), req.body.name);
      list.push({"logicType":"codelist", "language":"python", "categories":categories, "requiredCodes":requiredCodes});
    } else if(row["logicType"]=="age") {
      list.push({"logicType":"age", "language":"python", "ageLower":row["param"].split(":")[0], "ageUpper":row["param"].split(":")[1]});
    } else if(row["logicType"]=="lastEncounter") {
      list.push({"logicType":"lastEncounter", "language":"python", "maxYears":row["param"]});
    } else if(row["logicType"]=="codelistsTemporal") {
      let fileBefore = row["param"].split(":")[0];
      let fileAfter = row["param"].split(":")[1];
      let codesBefore = [...new Set(req.body.csvs.filter((csv)=>csv.filename==fileBefore).map((csv)=>csv.content)[0].map((row)=>"\""+ImporterUtils.getValue(row)+"\""))];
      let categoriesAfter = ImporterUtils.getCategories(req.body.csvs.filter((csv)=>csv.filename==fileAfter), ImporterUtils.getName(fileAfter));
      let minDays = row["param"].split(":")[2];
      let maxDays = row["param"].split(":")[3];
      list.push({"logicType":"codelistsTemporal", "language":"python", "nameBefore":ImporterUtils.getName(fileBefore), "codesBefore":codesBefore, "categoriesAfter":categoriesAfter, "minDays":minDays, "maxDays":maxDays});
    } else if(row["logicType"]=="codelistExclude") {
      let fileExclude = row["param"].split(":")[0];
      let fileInclude = row["param"].split(":")[1];
      let codesExclude = [...new Set(req.body.csvs.filter((csv)=>csv.filename==fileExclude).map((csv)=>csv.content)[0].map((row)=>"\""+ImporterUtils.getValue(row)+"\""))];
      let categoriesInclude = ImporterUtils.getCategories(req.body.csvs.filter((csv)=>csv.filename==fileInclude), ImporterUtils.getName(fileInclude));
      list.push({"logicType":"codelistExclude", "language":"python", "nameExclude":ImporterUtils.getName(fileExclude), "codesExclude":codesExclude, "categoriesInclude":categoriesInclude});
    }
  }
  if(await importPhenotype(req.body.name, req.body.about, null, req.body.userName, null, list)) return res.sendStatus(200);
  else return res.sendStatus(500);
});

//

async function importLists(csvs, name, about, author, valueFunction, descriptionFunction, implementation) {
  let categories = await ImporterUtils.getCategories(csvs, name, valueFunction, descriptionFunction);
  if (categories) return await importPhenotype(name, about, categories, author, implementation);
  else return false;
}

async function importPhenotype(name, about, categories, userName, implementation="code", list=null) {

  const NAME = ImporterUtils.clean(sanitizeHtml(name));
  const ABOUT = sanitizeHtml(about).replace("&amp;", "and");
  const OUTPUT_EXTENSION = "csv";
  let workflowId, language;

  let existingWorkflowId = await existingWorkflow(NAME, ABOUT, userName, "read-potential-cases-disc");
  let existingWorkflowChanged = await importChangesExistingWorkflow(existingWorkflowId, categories);

  // Disc
  if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) {
    if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);

    workflowId = (existingWorkflowId||await createWorkflow(NAME, ABOUT, userName));
    if (!workflowId) return res.status(500).send("Error creating workflow");
    language = "python";
    
    // Add data read
    try {
      await createStep(workflowId, "read-potential-cases-disc", "Read potential cases from disc", "load", 1, "Potential cases of " + NAME, "Initial potential cases, read from disc.", OUTPUT_EXTENSION, "read-potential-cases.py", language, "templates/read-potential-cases-disc.py", {"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())});
    } catch(error) {
      logger.debug("Error creating first step from import: " + error);
      return false;
    }

    try {
      if(!list) {
        await createWorkflowStepsFromList(workflowId, NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName);
      } else {
        await createWorkflowStepsFromList(workflowId, NAME, OUTPUT_EXTENSION, list, userName);
      }
    } catch(error) {
      logger.debug("Error creating workflow steps: " + error);
      return false;
    }
  }
  
  // i2b2
  existingWorkflowId = await existingWorkflow(NAME, ABOUT, userName, "read-potential-cases-i2b2");
  existingWorkflowChanged = await importChangesExistingWorkflow(existingWorkflowId, categories);

  if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) {
    if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);

    workflowId = (existingWorkflowId||await createWorkflow(NAME, ABOUT, userName));
    if(!workflowId) return false;
    language = "js";

    // Add data read (i2b2)
    try {
      await createStep(workflowId, "read-potential-cases-i2b2", "Read potential cases from i2b2", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from i2b2.", OUTPUT_EXTENSION, "read-potential-cases-i2b2.js", language, "templates/read-potential-cases-i2b2.js", {"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())});
    } catch(error) {
      logger.debug("Error creating first step from import: " + error);
      return false;
    }

    language = "python";
    try {
      if(!list) {
        await createWorkflowStepsFromList(workflowId, NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName);
      } else {
        await createWorkflowStepsFromList(workflowId, NAME, OUTPUT_EXTENSION, list, userName);
      }
    } catch(error) {
      logger.debug("Error creating workflow steps (i2b2): " + error);
      return false;
    }
  }

  // omop
  existingWorkflowId = await existingWorkflow(NAME, ABOUT, userName, "read-potential-cases-omop");
  existingWorkflowChanged = await importChangesExistingWorkflow(existingWorkflowId, categories);

  if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) {
    if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);

    workflowId = (existingWorkflowId||await createWorkflow(NAME, ABOUT, userName));
    if(!workflowId) return false;
    language = "js";

    // Add data read (omop)
    try {
      await createStep(workflowId, "read-potential-cases-omop", "Read potential cases from an OMOP db.", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from an OMOP DB.", OUTPUT_EXTENSION, "read-potential-cases-omop.js", language, "templates/read-potential-cases-omop.js", {"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())});
    } catch(error) {
      logger.debug("Error creating first step from import: " + error);
      return false;
    }

    language = "python";
    try {
      if(!list) {
        await createWorkflowStepsFromList(workflowId, NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName);
      } else {
        await createWorkflowStepsFromList(workflowId, NAME, OUTPUT_EXTENSION, list, userName);
      }
    } catch(error) {
      logger.debug("Error creating workflow steps (omop): " + error);
      return false;
    }
  }

  // fhir
  existingWorkflowId = await existingWorkflow(NAME, ABOUT, userName, "read-potential-cases-fhir");
  existingWorkflowChanged = await importChangesExistingWorkflow(existingWorkflowId, categories);

  if(!existingWorkflowId||(existingWorkflowId&&existingWorkflowChanged)) {
    if(existingWorkflowChanged) await WorkflowUtils.deleteStepsFromWorkflow(existingWorkflowId);

    workflowId = (existingWorkflowId||await createWorkflow(NAME, ABOUT, userName));
    if(!workflowId) return false;
    language = "js";

    // Add data read (fhir)
    try {
      await createStep(workflowId, "read-potential-cases-fhir", "Read potential cases from a FHIR server.", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from a FHIR server.", OUTPUT_EXTENSION, "read-potential-cases-fhir.js", language, "templates/read-potential-cases-fhir.js", {"PHENOTYPE":ImporterUtils.clean(NAME.toLowerCase())});
    } catch(error) {
      logger.debug("Error creating first step from import: " + error);
      return false;
    }

    language = "python";
    try {
      if(!list) {
        await createWorkflowStepsFromList(workflowId, NAME, OUTPUT_EXTENSION, [{"logicType":(implementation=="code"?"codelist":"keywordlist"), "language":language, "implementation":implementation, "categories":categories, "requiredCodes":1}], userName);
      } else {
        await createWorkflowStepsFromList(workflowId, NAME, OUTPUT_EXTENSION, list, userName);
      }
    } catch(error) {
      logger.debug("Error creating workflow steps (fhir): " + error);
      return false;
    }
  }

  return true;
}

async function importChangesExistingWorkflow(workflowId, categories) {
  if(!workflowId||!categories) return false;
  let steps = await models.step.findAll({where:{workflowId:workflowId}});
  if(!steps.length) return false;
  let existingStepNames = steps.map((step)=>step.name).filter((step)=>!step.includes("read-")&&!step.includes("output-"));
  let newStepNames = Object.keys(categories).map((category)=>ImporterUtils.clean(category.toLowerCase()));
  return !(existingStepNames.sort().toString()==newStepNames.sort().toString());
}

async function existingWorkflow(name, about, userName, connectorStepName) {
  try {
    let workflows = await models.workflow.findAll({where: {name:name, about:about, userName:sanitizeHtml(userName)}});
    if(workflows.length) {
      if(workflows.length>4) throw "More than one match when checking for existing workflows.";
      for(let workflow of workflows) {
        try {
          let steps = await models.step.findAll({where:{workflowId:workflow.id}});
          if(steps.map((step)=>step.name).includes(connectorStepName)) {
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

async function createWorkflowStepsFromList(workflowId, name, outputExtension, list, userName) {
  
  let position=2;

  for(let item of list) {
    if(item.logicType=="codelist") {
      position = await createCodeWorkflowSteps(workflowId, name, item.language, outputExtension, userName, item.categories, position, item.requiredCodes);
    } else if(item.logicType=="keywordlist") {
      position = await createKeywordWorkflowSteps(workflowId, name, item.language, outputExtension, userName, item.categories, position);
    } else if(item.logicType=="age") {
      let stepShort = "age between " + item.ageLower + " and " + item.ageUpper + " yo";
      let stepName = ImporterUtils.clean(stepShort);
      let stepDoc = "Age of patient is between " + item.ageLower + " and " + item.ageUpper;
      let stepType = "logic";
      let inputDoc = "Potential cases of " + name;
      let outputDoc = "Patients who are between " + item.ageLower + " and " + item.ageUpper + " years old.";
      let fileName = ImporterUtils.clean(stepShort) + ".py";

      try {
        await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, item.language, "templates/age.py", {"PHENOTYPE":ImporterUtils.clean(name.toLowerCase()), "AGE_LOWER":item.ageLower, "AGE_UPPER":item.ageUpper, "AUTHOR":userName, "YEAR":new Date().getFullYear()});
      } catch(error) {
        error = "Error creating imported step (" + stepName + "): " + error;
        throw error;
      }
      position++;
    } else if(item.logicType=="lastEncounter") {
      let stepShort = "last encounter not greater than " + item.maxYears + " years";
      let stepName = ImporterUtils.clean(stepShort);
      let stepDoc = "Last interaction with patient is not more than " + item.maxYears + " years ago";
      let stepType = "logic";
      let inputDoc = "Potential cases of " + name;
      let outputDoc = "Patients with an encounter less than " + item.maxYears + " years ago.";
      let fileName = ImporterUtils.clean(stepShort) + ".py";

      try {
        await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, item.language, "templates/last-encounter.py", {"PHENOTYPE":ImporterUtils.clean(name.toLowerCase()), "MAX_YEARS":item.maxYears, "AUTHOR":userName, "YEAR":new Date().getFullYear()});
      } catch(error) {
        error = "Error creating imported step (" + stepName + "): " + error;
        throw error;
      }
      position++;
    } else if(item.logicType=="codelistsTemporal") {
      // Compare each 'after' category to the single 'before' code list in 'days after' relationship 
      for(let categoryAfter in item.categoriesAfter) {
        let stepShort = ImporterUtils.clean(categoryAfter.toLowerCase())+" "+item.minDays+" to "+item.maxDays+" days after "+ImporterUtils.clean(item.nameBefore.toLowerCase());
        let stepName = ImporterUtils.clean(stepShort);
        categoryAfter = ImporterUtils.clean(categoryAfter, true);
        let stepDoc = "Diagnosis of "+(categoryAfter.substr(0, categoryAfter.lastIndexOf("-"))+ "("+categoryAfter.substr(categoryAfter.lastIndexOf("-")+2)+")")+" between "+item.minDays+" and "+item.maxDays+" days after a diagnosis of "+ImporterUtils.clean(item.nameBefore, true);
        let stepType = "logic";
        let inputDoc = "Potential cases of "+name;
        let outputDoc = "Patients with clinical codes indicating "+name+" related events in electronic health record.";
        let fileName = ImporterUtils.clean(stepShort) + ".py";

        try {
          await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, item.language, "templates/codelists-temporal.py", {"PHENOTYPE":ImporterUtils.clean(name.toLowerCase()), "LIST_BEFORE":item.codesBefore, "LIST_AFTER":"\""+item.categoriesAfter[categoryAfter].join('","')+"\"", "MIN_DAYS":item.minDays, "MAX_DAYS": item.maxDays, "CATEGORY":ImporterUtils.clean(item.nameBefore.toLowerCase())+"-"+ImporterUtils.clean(categoryAfter.toLowerCase()), "AUTHOR":userName, "YEAR":new Date().getFullYear()});
        } catch(error) {
          error = "Error creating imported step (" + stepName + "): " + error;
          throw error;
        }
        position++;
      }
    } else if(item.logicType=="codelistExclude") {
      for(let categoryInclude in item.categoriesInclude) {
        let stepShort = ImporterUtils.clean(categoryInclude.toLowerCase())+" without "+ImporterUtils.clean(item.nameExclude.toLowerCase());
        let stepName = ImporterUtils.clean(stepShort);
        categoryInclude = ImporterUtils.clean(categoryInclude, true);
        let stepDoc = "Identify "+(categoryInclude.substr(0, categoryInclude.lastIndexOf("-"))+"("+categoryInclude.substr(categoryInclude.lastIndexOf("-")+2)+")")+" without a diagnosis of "+ImporterUtils.clean(item.nameExclude, true);
        let stepType = "logic";
        let inputDoc = "Potential cases of "+name;
        let outputDoc = "Patients with clinical codes indicating "+name+" related events in electronic health record.";
        let fileName = ImporterUtils.clean(stepShort) + ".py";

        try {
          await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, item.language, "templates/codelist-exclude.py", {"PHENOTYPE":ImporterUtils.clean(name.toLowerCase()), "LIST_EXCLUDE":item.codesExclude, "LIST_INCLUDE":"\""+item.categoriesInclude[categoryInclude].join('","')+"\"", "CATEGORY":ImporterUtils.clean(categoryInclude.toLowerCase()), "AUTHOR":userName, "YEAR":new Date().getFullYear()});
        } catch(error) {
          error = "Error creating imported step (" + stepName + "): " + error;
          throw error;
        }
        position++;
      }
    }
  }

  await addFileWrite(workflowId, position, name, outputExtension, "python");
  
}

async function addFileWrite(workflowId, position, name, outputExtension, language) {
  try {
    await createStep(workflowId, "output-cases", "Output cases", "output", position, "Potential cases of " + name, "Output containing patients flagged as having this type of " + name, outputExtension, "output-cases.py", language, "templates/output-cases.py", {"PHENOTYPE":ImporterUtils.clean(name.toLowerCase())});
  } catch(error) {
    error = "Error creating last step from import: " + error;
    throw error;
  }
  await WorkflowUtils.workflowComplete(workflowId);
}

async function createKeywordWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, position=2) {
  return await createCategoryWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, "keywords", "templates/keywords.py", position);
}

async function createCodeWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, position=2, requiredCodes=1) {
  return await createCategoryWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, "clinical codes", "templates/codelist.py", position, requiredCodes);
}

async function createCategoryWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, categoryType, template, position=2, requiredCodes=1) {

  // For each code set
  for(var category in categories) {
    let stepName = ImporterUtils.clean(category.toLowerCase());
    let stepDoc = "Identify " + ImporterUtils.clean(category, true);
    let stepType = "logic";
    let inputDoc = "Potential cases of " + name;
    let outputDoc = "Patients with " + categoryType + " indicating " + name + " related events in electronic health record.";
    let fileName = ImporterUtils.clean(category.toLowerCase()) + ".py";

    try {
      await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, language, template, {"PHENOTYPE":name.toLowerCase().replace(/ /g, "-"), "CATEGORY":ImporterUtils.clean(category.toLowerCase()), "LIST":'"' + categories[category].join('","') + '"', "REQUIRED_CODES":requiredCodes, "AUTHOR":userName, "YEAR":new Date().getFullYear()});
    } catch(error) {
      error = "Error creating imported step (" + stepName + "): " + error;
      throw error;
    }

    position++;
  }

  return position;

}

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
  for(var substitution in substitutions) {
    if(!implementationTemplate.includes(substitution)) throw "Attempted substitition of non-existent variable in template for " + implementationTemplatePath + " by " + stepName;
    implementationTemplate = implementationTemplate.replace(new RegExp("\\\[" + substitution + "\\\]", "g"), substitutions[substitution]);
  }
  const destination = "uploads/" + workflowId + "/" + language;

  try {
    await fs.stat(destination);
  } catch(error) {
    await fs.mkdir(destination, {recursive:true});
  }

  fs.writeFile(destination + "/" + fileName.replace(/\//g, ""), implementationTemplate);

}

async function createWorkflow(name, about, userName) {
  try {
    var workflow = await models.workflow.create({name:name, about:about, userName:sanitizeHtml(userName)});
    return workflow.id;
  } catch(error) {
    error = "Error creating workflow for CSV: " + (error&&error.errors&&error.errors[0]&&error.errors[0].message?error.errors[0].message:error);
    logger.debug(error);
    return false;
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
