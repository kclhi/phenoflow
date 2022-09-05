const fs = require('fs').promises;
const logger = require('../config/winston');
const config = require('config');
const models = require('../models');

const Zip = require("./zip");
const ImporterUtils = require("./importer");

class Download {

  static async createPFZipFile(id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise=false) {
    let archive = await Zip.createFile(name);
    return await Download.createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise);
  }

  static async createPFZipResponse(res, id, name, workflow, workflowInputs, implementationUnits, steps, about) {
    let archive = Zip.createResponse(name, res);
    return await Download.createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, true);
  }

  static async createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise) {
    Zip.add(archive, workflow, name+".cwl");
    Zip.add(archive, workflowInputs, name+"-inputs.yml");
    if(steps && steps[0] && steps[0].type.indexOf("external") < 0) await Zip.addFile(archive, "templates/", "replaceMe.csv");

    for(let step of steps) {
      Zip.add(archive, step.content, step.name+".cwl");
      try {
        if(step.fileName) await Zip.addFile(archive, "uploads/"+step.workflowId+"/", (implementationUnits&&implementationUnits[step.name]?implementationUnits[step.name]:implementationUnits)+"/"+step.fileName);
      } catch(addFileError) {
        logger.error("Failed to add file to archive: "+addFileError);
        return false;
      }
    }

    let readme = await fs.readFile("templates/README.md", "utf8");
    readme = readme.replace(/\[id\]/g, name);
    readme = readme.replace(/\[about\]/g, about);
    Zip.add(archive, readme, "README.md");
    let license = await fs.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    Zip.add(archive, license, "LICENSE.md");
    Zip.output(archive);
    return true;
  }

}

module.exports = Download;
