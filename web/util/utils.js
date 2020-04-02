const ZIP = require("./zip");

class Utils {

  static async createZIP(workflowId, workflow, steps) {

    let archive = await ZIP.create(workflowId);
    await ZIP.add(archive, workflow, workflowId + ".cwl");
    for ( const step in steps ) {
      await ZIP.add(archive, steps[step].content, steps[step].stepId + ".cwl");
    }
    await ZIP.output(archive);

  }

}

module.exports = Utils;
