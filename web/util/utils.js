const logger = require('../config/winston');
const fs = require('fs').promises;
const Zip = require("./zip");

class Utils {

  static async createPFZipFile(name, workflow, workflowInputs, implementationUnits, steps, about) {

    let archive = await Zip.createFile(name);
    await Utils.createPFZip(archive, name, workflow, workflowInputs, implementationUnits, steps, about)

  }

  static async createPFZipResponse(res, name, workflow, workflowInputs, implementationUnits, steps, about) {

    let archive = await Zip.createResponse(name, res);
    await Utils.createPFZip(archive, name, workflow, workflowInputs, implementationUnits, steps, about)

  }

  static async createPFZip(archive, name, workflow, workflowInputs, implementationUnits, steps, about) {

    await Zip.add(archive, workflow, name + ".cwl");
    await Zip.add(archive, workflowInputs, name + "-inputs.yml");
    await Zip.add(archive, "", "replaceMe.csv");

    for ( const step in steps ) {
      await Zip.add(archive, steps[step].content, steps[step].stepId + ".cwl");
      await Zip.addFile(archive, "uploads/", implementationUnits[steps[step].stepId] + "/" + steps[step].fileName);
    }

    let readme = await fs.readFile("templates/README.md", "utf8");
    readme = readme.replace(/\[id\]/g, name);
    readme = readme.replace(/\[about\]/g, about);
    await Zip.add(archive, readme, "README.md");
    let license = await fs.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    await Zip.add(archive, license, "LICENSE.md");
    await Zip.output(archive);

  }

}

module.exports = Utils;
