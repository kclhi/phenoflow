const ZIP = require("./zip");

class Utils {

  static async createPFZip(workflowId, workflow, workflowInputs, language, steps) {

    let archive = await ZIP.create(workflowId);
    await ZIP.add(archive, workflow, workflowId + ".cwl");
    await ZIP.add(archive, workflowInputs, workflowId + "-inputs.cwl");
    for ( const step in steps ) {
      await ZIP.add(archive, steps[step].content, steps[step].stepId + ".cwl");
      await ZIP.addFile(archive, "uploads/", language + "/" + steps[step].fileName);
    }
    await ZIP.output(archive);

  }

}

module.exports = Utils;
