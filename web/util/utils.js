const logger = require('../config/winston');
const ZIP = require("./zip");

class Utils {

  static async createPFZipFile(workflowId, workflow, workflowInputs, language, steps) {

    let archive = await ZIP.createFile(workflowId);
    return await Utils.createPFZip(archive, workflowId, workflow, workflowInputs, language, steps)

  }

  static async createPFZipResponse(res, workflowId, workflow, workflowInputs, language, steps) {

    let archive = await ZIP.createResponse(workflowId, res);
    return await Utils.createPFZip(archive, workflowId, workflow, workflowInputs, language, steps)

  }

  static async createPFZip(archive, workflowId, workflow, workflowInputs, language, steps) {

    await ZIP.add(archive, workflow, workflowId + ".cwl");
    await ZIP.add(archive, workflowInputs, workflowId + "-inputs.cwl");
    for ( const step in steps ) {
      await ZIP.add(archive, steps[step].content, steps[step].stepId + ".cwl");
      await ZIP.addFile(archive, "uploads/", language + "/" + steps[step].fileName);
    }
    await ZIP.output(archive);
    return archive;

  }

}

module.exports = Utils;
