const fs = require('fs').promises;
const logger = require('../config/winston');
const config = require('config');
const Visualise = require("./visualise");
const Zip = require("./zip");

class Download {

  static async createPFZipFile(id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise=false) {

    let archive = await Zip.createFile(name);
    return await Download.createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise)

  }

  static async createPFZipResponse(res, id, name, workflow, workflowInputs, implementationUnits, steps, about) {

    let archive = await Zip.createResponse(name, res);
    return await Download.createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, true)

  }

  static async createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise) {

    await Zip.add(archive, workflow, name + ".cwl");
    await Zip.add(archive, workflowInputs, name + "-inputs.yml");
    if(steps && steps[0] && steps[0].type.indexOf("external") < 0) await Zip.add(archive, "", "replaceMe.csv");

    for(const step in steps) {
      await Zip.add(archive, steps[step].content, steps[step].name + ".cwl");
      await Zip.addFile(archive, "uploads/" + id + "/", (implementationUnits[steps[step].name]?implementationUnits[steps[step].name]:implementationUnits) + "/" + steps[step].fileName);
    }

    if(visualise) {
      const timestamp="" + Math.floor(new Date() / 1000);
			const GIT_SERVER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.HOST") + config.get("gitserver.PORT");
			if(await Visualise.commitPushWorkflowRepo(id, timestamp, name, workflow, steps)) {
  			let png = await Visualise.getWorkflowPNGFromViewer(id + timestamp, name);
  			if (!png) {
  				let queueLocation = await Visualise.addWorkflowToViewer(id + timestamp, name);
  				png = await Visualise.getWorkflowFromViewer(id + timestamp, name, queueLocation);
          await Zip.add(archive, png, "abstract.png");
  			}
      } else {
        logger.debug("Error creating visualisation for ZIP.");
        return false;
      }
		}

    let readme = await fs.readFile("templates/README.md", "utf8");
    readme = readme.replace(/\[id\]/g, name);
    readme = readme.replace(/\[about\]/g, about);
    await Zip.add(archive, readme, "README.md");
    let license = await fs.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    await Zip.add(archive, license, "LICENSE.md");
    await Zip.output(archive);
    return true;

  }

}

module.exports = Download;
