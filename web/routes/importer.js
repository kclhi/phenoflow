const express = require('express');
const router = express.Router();
const logger = require('../config/winston');
const models = require('../models');
const sequelize = require('sequelize');
const op = sequelize.Op;
const jwt = require('express-jwt');
const fs = require('fs').promises;
const sanitizeHtml = require('sanitize-html');
const nlp = require('compromise');
const stringSimilarity = require("string-similarity");
const natural = require("natural");
const stemmer = natural.PorterStemmer;

const config = require("config");
const Workflow = require("../util/workflow");
const WorkflowUtils = require("../util/workflow");
const { workflow } = require('../util/workflow');

function primaryCodeKeys() {
  return ["readcode", "snomedconceptid", "readv2code", "snomedcode", "snomedctconceptid", "conceptcode", "conceptcd", "snomedctcode", "conceptid"];
}

function secondaryCodeKeys() {
  return ["icdcode", "icd10code", "icd11code", "opcs4code", "icdcodeuncat"];
}

function clean(input) {
  if(!input) return input;
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCategories(csvFiles, name, valueFunction, descriptionFunction) {
  let categories = {};
  const primaryCodingSystems = ["read", "snomed", "snomedct"];
  const secondaryCodingSystems = ["icd9", "icd10", "cpt", "icd10cm", "icd9cm", "icd9diagnosis", "icd10diagnosis"];
  const codingSystems = primaryCodingSystems.concat(secondaryCodingSystems);
  function singular(term) { return nlp(term).nouns().toSingular().text() || term; }
  function getKeyTerm(phrase, name) {
    if(phrase.split(" ").filter(word=>name.toLowerCase().includes(word.toLowerCase()))) return name;
    let nouns = nlp(phrase).nouns().text().split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(categoryClean(word)));
    let adjectives = nlp(phrase).adjectives().text().split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(categoryClean(word)));
    return nouns.length?categoryClean(nouns[0]):categoryClean(adjectives[0]);
  }
  function orderKey(key) {
    // Don't attempt reorder on more than two words
    let keyTerms = key.split(" ");
    if(keyTerms.length!=2) return key.charAt(0).toUpperCase() + key.slice(1);
    let nlpKey = nlp(key);
    let adjectives = nlpKey.adjectives()?nlpKey.adjectives().out("text").split(" "):null;
    let nouns = nlpKey.nouns()?nlpKey.nouns().out("text").split(" "):null;
    // Adjectives first; both nouns, condition first
    if(adjectives&&adjectives.length==1&&adjectives[0]!=keyTerms[0]
      ||nouns&&nouns.length==2&&name!=keyTerms[0]) {
        key=keyTerms[1].toLowerCase();
        key+=" "+keyTerms[0].toLowerCase();
    }
    key=key.charAt(0).toUpperCase() + key.slice(1);
    return key;
  }
  function findAndCapitaliseName(text) {
    let newText="";
    for(let word of text.split(" ")) {
      if(name.toLowerCase().includes(word.toLowerCase())) newText+=word.charAt(0).toUpperCase() + word.substring(1)+" ";
      else newText+=word+" ";
    }
    return newText.substring(0,newText.length-1);
  }
  for(let csvFile of csvFiles) {
    let codingSystem, termCount={};
    csvFile=csvFile.filter(row=>(row["case_incl"]&&row["case_incl"]!="N")||!row["case_incl"]);
    // Initial cleaning and counting terms
    for(let row of csvFile) {
      // Remove special characters from keys that prevent indexing
      for(const [key, value] of Object.entries(row)) {
        if(key!=clean(key)) {
          row[clean(key)] = row[key];
          delete row[key];
          continue;
        }
        if(key!=key.toLowerCase()) {
          row[key.toLowerCase()] = row[key];
          delete row[key];
        }
      }
      let description=descriptionFunction(row);
      if(description) {
        for(let term of description.split(" ")) {
          term = singular(clean(term));
          if(name.split(" ").map(word=>categoryClean(word)).filter(word=>word.includes(term)).length
          || name.split(" ").map(word=>categoryClean(stemmer.stem(word))).filter(word=>word.includes(stemmer.stem(term))).length 
          || name.split(" ").filter(word=>term.includes(categoryClean(word)||stemmer.stem(term).includes(categoryClean(stemmer.stem(word))))).length 
          || term.length<=4) continue;
          Object.keys(termCount).includes(term)?termCount[term]=termCount[term]+=1:termCount[term]=1;
        }
      }
    }
    var primarySecondary = ((codingSystem=csvFile[0]["codingsystem"]||csvFile[0]["codetype"]||csvFile[0]["vocabulary"])&&primaryCodingSystems.includes(clean(codingSystem)))||primaryCodeKeys().filter(primaryCodeKey=>Object.keys(csvFile[0]).map(key=>clean(key)).includes(clean(primaryCodeKey))).length?"primary":"secondary";
    const NOT_DIFFERENTIATING_CUTOFF=0.15;
    let termCountArray = Object.keys(termCount).map(key=>[key, termCount[key]]).filter(term=>term[1]>1);
    termCountArray.sort(function(first, second) { return second[1]-first[1]; });
    let numberOfTerms = termCountArray.length?termCountArray.map(term=>term[1]).reduce((a,b)=>a+b):0;
    let notDifferentiatingSubset = termCountArray.filter(term=>term[1]/parseFloat(numberOfTerms)>=NOT_DIFFERENTIATING_CUTOFF).map(term=>term[0]);
    // Exclude those terms too that are shorthand for those in the excluded subet
    notDifferentiatingSubset = notDifferentiatingSubset.concat(termCountArray.filter(term=>notDifferentiatingSubset.filter(subsetTerm=>subsetTerm!=term[0]&&subsetTerm.includes(term[0])).length));

    for(let row of csvFile) {
      let category, description=descriptionFunction(row);
      if(description) {
        let code=valueFunction(row);
        // Remaining work to categorise descriptions
        if(termCountArray.length) {
          let matched=false;
          for(let term of termCountArray.filter(term=>!notDifferentiatingSubset.includes(term)).map(term=>term[0]).reverse()) {
            if(description.split(" ").filter(word=>stringSimilarity.compareTwoStrings(singular(clean(word)), term) >= 0.8 
            || term.includes(singular(clean(word))) 
            || singular(clean(word)).includes(term)).length) {
              categories[term+"--"+primarySecondary]?categories[term+"--"+primarySecondary].push(code):categories[term+"--"+primarySecondary]=[code];
              matched=true;
              break;
            }
          }
          // If no common term, pick most representative term from description
          if(!matched) {
            let keyTerm = getKeyTerm(description, name);
            categories[keyTerm+"--"+primarySecondary]?categories[keyTerm+"--"+primarySecondary].push(code):categories[keyTerm+"--"+primarySecondary]=[code];
          }
        } else if(csvFile.length==1) {
          // If there's only one code, use its description
          category=findAndCapitaliseName(description)+"--"+primarySecondary;
          categories[category]?categories[category].push(code):categories[category]=[code];
        } else {
          // Otherwise, just use the name of the definition itself
          category=name+"--"+primarySecondary;
          categories[category]?categories[category].push(code):categories[category]=[code];
        }
      } else if(category=row["category"]||row["calibercategory"]) {
        let code=valueFunction(row);
        category+="--"+primarySecondary;
        categories[category]?categories[category].push(code):categories[category]=[code];
      } else if(row["prodcode"]) {
        category="Use of "+row["drugsubstance"]+"--"+primarySecondary;
        categories[category]?categories[category].push(row["prodcode"]):categories[category]=[row["prodcode"]];
      } else if(row["code"]) {
        category=name+" - UK Biobank"+"--"+primarySecondary;
        categories[category]?categories[category].push(row["code"]):categories[category]=[row["code"]];
      } else {
        logger.warn("No handler for: "+JSON.stringify(row)+" "+name);
        //return false;
      }
    }
  }

  let formattedCategories = {};
  for(const [term, codes] of Object.entries(categories)) {
    let termAndPrimarySecondary = term.split("--");
    let suffix = (!clean(termAndPrimarySecondary[0]).includes(clean(name))&&!clean(name).includes(clean(termAndPrimarySecondary[0])))?" "+name:"";
    termAndPrimarySecondary[0]==name?formattedCategories[termAndPrimarySecondary[0]+suffix+" - "+termAndPrimarySecondary[1]] = categories[term]:formattedCategories[orderKey(termAndPrimarySecondary[0]+suffix)+" - "+termAndPrimarySecondary[1]] = categories[term];
  }

  if(Object.keys(categories).length == 0 || Object.keys(categories).indexOf("undefined - primary")>-1 || Object.keys(categories).indexOf("undefined - secondary")>-1) {
    logger.error("No category for " + name + ": " + JSON.stringify(categories));
    return false;
  }

  return formattedCategories;
}

function getValue(row) {
  if(row["code"]) return row["code"];
  let otherKeyCodes;
  const codeKeys = primaryCodeKeys().concat(secondaryCodeKeys());
  if((otherKeyCodes=Object.keys(row).filter(key=>codeKeys.includes(key.toLowerCase())))&&otherKeyCodes) for(let keyCode of otherKeyCodes) if(row[keyCode]) return row[keyCode];
  throw "No usable value for "+JSON.stringify(row)+" "+otherKeyCodes;
}

function getDescription(row) {
  const descriptions = ["description", "conceptname", "proceduredescr", "icd10term", "icd11term", "snomedterm", "icd10codedescr", "icdterm", "readterm", "readcodedescr", "term", "snomedctterm"];
  let description = row[Object.keys(row).filter(key=>descriptions.includes(categoryClean(key)))[0]];
  if(description) description = description.replace("[X]", "").replace("[D]", "")
  if(description&&description.includes(" ")) description=description.split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(categoryClean(word))).join(" ");
  return description;
}

async function importLists(csvs, name, about, author, valueFunction, descriptionFunction, implementation) {
  let categories = await getCategories(csvs, name, valueFunction, descriptionFunction);
  if (categories) return await importPhenotype(name, about, categories, author, implementation);
  else return false;
}

router.post('/importCodelists', jwt({secret:config.get("jwt.RSA_PRIVATE_KEY"), algorithms:['RS256']}), async function(req, res, next) {
  req.setTimeout(0);
  if(!req.body.csvs||!req.body.name||!req.body.about||!req.body.userName) res.status(500).send("Missing params.");
  if(await importLists(req.body.csvs.map((csv)=>csv.content), req.body.name, req.body.about, req.body.userName, getValue, getDescription, "code")) return res.sendStatus(200);
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
    if(description&&description.includes(" ")) description=description.split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(categoryClean(word))).join(" ");
    return description;
  }
  
  if(await importLists([req.body.keywords.content], req.body.name, req.body.about, req.body.userName, getValue, getDescription, "keywords")) return res.sendStatus(200);
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
      let categories = await getCategories(req.body.csvs.filter((csv)=>csv.filename==file).map((csv)=>csv.content), req.body.name, getValue, getDescription);
      list.push({"logicType":"codelist", "language":"python", "categories":categories, "requiredCodes":requiredCodes});
    } else if(row["logicType"]=="age") {
      list.push({"logicType":"age", "language":"python", "ageLower":row["param"].split(":")[0], "ageUpper":row["param"].split(":")[1]});
    } else if(row["logicType"]=="lastEncounter") {
      list.push({"logicType":"lastEncounter", "language":"python", "maxYears":row["param"]});
    }
  }
  if(await importPhenotype(req.body.name, req.body.about, null, req.body.userName, null, list)) return res.sendStatus(200);
  else return res.sendStatus(500);
});

//

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

function categoryClean(input, spaces=false) {

  input = input.replace(/\//g, "").replace(/(\s)?\(.*\)/g, "").replace(/\,/g, "").replace(/&amp;/g, "and");
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
    return false;
  }

}

async function createCategoryWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, categoryType, template, position=2, requiredCodes=1) {

  // For each code set
  for(var category in categories) {
    let stepName = categoryClean(category.toLowerCase());
    let stepDoc = "Identify " + categoryClean(category, true);
    let stepType = "logic";
    let inputDoc = "Potential cases of " + name;
    let outputDoc = "Patients with " + categoryType + " indicating " + name + " related events in electronic health record.";
    let fileName = categoryClean(category.toLowerCase()) + ".py";

    try {
      await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, language, template, {"PHENOTYPE":name.toLowerCase().replace(/ /g, "-"), "CATEGORY":categoryClean(category.toLowerCase()), "LIST":'"' + categories[category].join('","') + '"', "REQUIRED_CODES":requiredCodes, "AUTHOR":userName, "YEAR":new Date().getFullYear()});
    } catch(error) {
      error = "Error creating imported step (" + stepName + "): " + error;
      throw error;
    }

    position++;
  }

  return position;

}

async function addFileWrite(workflowId, position, name, outputExtension, language) {

  try {
    await createStep(workflowId, "output-cases", "Output cases", "output", position, "Potential cases of " + name, "Output containing patients flagged as having this type of " + name, outputExtension, "output-cases.py", language, "templates/output-cases.py", {"PHENOTYPE":categoryClean(name.toLowerCase())});
  } catch(error) {
    error = "Error creating last step from import: " + error;
    throw error;
  }

  await Workflow.workflowComplete(workflowId);

}

async function createCodeWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, position=2, requiredCodes=1) {

  return await createCategoryWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, "clinical codes", "templates/codelist.py", position, requiredCodes);

}

async function createKeywordWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, position=2) {

  return await createCategoryWorkflowSteps(workflowId, name, language, outputExtension, userName, categories, "keywords", "templates/keywords.py", position);

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
      let stepName = categoryClean(stepShort);
      let stepDoc = "Age of patient is between " + item.ageLower + " and " + item.ageUpper;
      let stepType = "logic";
      let inputDoc = "Potential cases of " + name;
      let outputDoc = "Patients who are between " + item.ageLower + " and " + item.ageUpper + " years old.";
      let fileName = categoryClean(stepShort) + ".py";

      try {
        await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, item.language, "templates/age.py", {"PHENOTYPE":categoryClean(name.toLowerCase()), "AGE_LOWER":item.ageLower, "AGE_UPPER":item.ageUpper, "AUTHOR":userName, "YEAR":new Date().getFullYear()});
      } catch(error) {
        error = "Error creating imported step (" + stepName + "): " + error;
        throw error;
      }
      position++;
    } else if(item.logicType=="lastEncounter") {
      let stepShort = "last encounter not greater than " + item.maxYears + " years";
      let stepName = categoryClean(stepShort);
      let stepDoc = "Last interaction with patient is not more than " + item.maxYears + " years ago";
      let stepType = "logic";
      let inputDoc = "Potential cases of " + name;
      let outputDoc = "Patients with an encounter less than " + item.maxYears + " years ago.";
      let fileName = categoryClean(stepShort) + ".py";

      try {
        await createStep(workflowId, stepName, stepDoc, stepType, position, inputDoc, outputDoc, outputExtension, fileName, item.language, "templates/last-encounter.py", {"PHENOTYPE":categoryClean(name.toLowerCase()), "MAX_YEARS":item.maxYears, "AUTHOR":userName, "YEAR":new Date().getFullYear()});
      } catch(error) {
        error = "Error creating imported step (" + stepName + "): " + error;
        throw error;
      }
      position++;
    }
  }

  await addFileWrite(workflowId, position, name, outputExtension, "python");
  
}

async function existingWorkflow(name, about, userName, connectorStepName) {

  try {
    let workflows = await models.workflow.findAll({where: {name:name, about:about, userName:sanitizeHtml(userName)}});
    if(workflows.length) {
      if(workflows.length>3) throw "More than one match when checking for existing workflows.";
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

async function importChangesExistingWorkflow(workflowId, categories) {

  if(!workflowId) return false;
  let steps = await models.step.findAll({where:{workflowId:workflowId}});
  if(!steps.length) return false;
  let existingStepNames = steps.map((step)=>step.name).filter((step)=>!step.includes("read-")&&!step.includes("output-"));
  let newStepNames = Object.keys(categories).map((category)=>categoryClean(category.toLowerCase()));
  return !(existingStepNames.sort().toString()==newStepNames.sort().toString());

}

async function importPhenotype(name, about, categories, userName, implementation="code", list=null) {

  const NAME = categoryClean(sanitizeHtml(name));
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
      await createStep(workflowId, "read-potential-cases-disc", "Read potential cases from disc", "load", 1, "Potential cases of " + NAME, "Initial potential cases, read from disc.", OUTPUT_EXTENSION, "read-potential-cases.py", language, "templates/read-potential-cases-disc.py", {"PHENOTYPE":categoryClean(NAME.toLowerCase())});
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
      await createStep(workflowId, "read-potential-cases-i2b2", "Read potential cases from i2b2", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from i2b2.", OUTPUT_EXTENSION, "read-potential-cases-i2b2.js", language, "templates/read-potential-cases-i2b2.js", {"PHENOTYPE":categoryClean(NAME.toLowerCase())});
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
      await createStep(workflowId, "read-potential-cases-omop", "Read potential cases from an OMOP db.", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from an OMOP DB.", OUTPUT_EXTENSION, "read-potential-cases-omop.js", language, "templates/read-potential-cases-omop.js", {"PHENOTYPE":categoryClean(NAME.toLowerCase())});
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
      await createStep(workflowId, "read-potential-cases-fhir", "Read potential cases from a FHIR server.", "external", 1, "Potential cases of " + NAME, "Initial potential cases, read from a FHIR server.", OUTPUT_EXTENSION, "read-potential-cases-fhir.js", language, "templates/read-potential-cases-fhir.js", {"PHENOTYPE":categoryClean(NAME.toLowerCase())});
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
