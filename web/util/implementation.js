const models = require('../models');
const logger = require('../config/winston');
const fs = require('fs').promises;

class Implementation {

  static async getCodes(workflowId) {

    let steps, implementations=[], primaryCodes=[], secondaryCodes=[];
    try {
      steps = await models.step.findAll({where:{workflowId:workflowId, type:'logic'}});
    } catch(error) {
      error = "Error getting steps for workflow: " + error;
      logger.debug(error);
      return null;
    }

    if(!steps) return null;
    for(let step of steps) {
      try {
        implementations.push(await models.implementation.findOne({where:{language:'python', stepId:step.id}}));
      } catch(error) {
        error = "Error getting implementation details: " + error;
        logger.debug(error);
        continue;
      }
    }
    
    if(!implementations) return null;
    for(let implementation of implementations) {
      let file;
      try {
        file = await fs.readFile("uploads/" + workflowId + "/python/" + implementation.fileName, "utf8");
      } catch(error) {
        error = "Error reading implementation: " + error;
        logger.debug(error);
        continue;
      }
      if(file)  {
        for(let line of file.split(/\r?\n/)) {
          if(line.startsWith("codes =")) {
            let list = line.match(/\[(.*)\]/);
            let newCodes = list[1].split(', ').map(code=>code.substring(1, code.length-1));
            if(list&&list[1]) implementation.fileName.includes("secondary")?secondaryCodes = secondaryCodes.concat(newCodes):primaryCodes = primaryCodes.concat(newCodes);
          }
        }
      }
    }
    
    return [{"system":"read/snomed", "codes":[...new Set(primaryCodes)]}, {"system":"icd/opcs/cpt", "codes":[...new Set(secondaryCodes)]}];

  } 

}

module.exports = Implementation;
