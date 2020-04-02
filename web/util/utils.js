const logger = require('../config/winston');
const fs = require('fs').promises;
const ZIP = require("./zip");

class Utils {

  static async createPFZipFile(name, workflow, workflowInputs, language, steps, about) {

    let archive = await ZIP.createFile(name);
    await Utils.createPFZip(archive, name, workflow, workflowInputs, language, steps, about)

  }

  static async createPFZipResponse(res, name, workflow, workflowInputs, language, steps, about) {

    let archive = await ZIP.createResponse(name, res);
    await Utils.createPFZip(archive, name, workflow, workflowInputs, language, steps, about)

  }

  static async createPFZip(archive, name, workflow, workflowInputs, language, steps, about) {

    await ZIP.add(archive, workflow, name + ".cwl");
    await ZIP.add(archive, workflowInputs, name + "-inputs.yml");

    for ( const step in steps ) {
      await ZIP.add(archive, steps[step].content, steps[step].stepId + ".cwl");
      await ZIP.addFile(archive, "uploads/", language + "/" + steps[step].fileName);
    }

    let readme = await fs.readFile("templates/README.md", "utf8");
    readme = readme.replace(/\[id\]/g, name);
    readme = readme.replace(/\[about\]/g, about);
    await ZIP.add(archive, readme, "README.md");
    let license = await fs.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    await ZIP.add(archive, license, "LICENSE.md");
    await ZIP.output(archive);

  }

}

module.exports = Utils;
