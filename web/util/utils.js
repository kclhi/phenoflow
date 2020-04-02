const logger = require('../config/winston');
const fs = require('fs').promises;
const ZIP = require("./zip");

class Utils {

  static async createPFZipFile(workflowId, workflow, workflowInputs, language, steps, about) {

    let archive = await ZIP.createFile(workflowId);
    return await Utils.createPFZip(archive, workflowId, workflow, workflowInputs, language, steps, about)

  }

  static async createPFZipResponse(res, workflowId, workflow, workflowInputs, language, steps, about) {

    let archive = await ZIP.createResponse(workflowId, res);
    return await Utils.createPFZip(archive, workflowId, workflow, workflowInputs, language, steps, about)

  }

  static async createPFZip(archive, workflowId, workflow, workflowInputs, language, steps, about) {

    await ZIP.add(archive, workflow, workflowId + ".cwl");
    await ZIP.add(archive, workflowInputs, workflowId + "-inputs.cwl");

    for ( const step in steps ) {
      await ZIP.add(archive, steps[step].content, steps[step].stepId + ".cwl");
      await ZIP.addFile(archive, "uploads/", language + "/" + steps[step].fileName);
    }

    let readme = await fs.readFile("templates/README.md", "utf8");
    readme = readme.replace(/\[id\]/g, workflowId);
    readme = readme.replace(/\[about\]/g, about);
    ZIP.add(archive, readme, "README.md");

    let license = await fs.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    ZIP.add(archive, license, "LICENSE.md");

    await ZIP.output(archive);
    return archive;

  }

}

module.exports = Utils;
