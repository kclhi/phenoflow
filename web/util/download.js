const fs = require('fs').promises;
const logger = require('../config/winston');
const config = require('config');
const models = require('../models');

const Visualise = require("./visualise");
const Zip = require("./zip");
const Zenodo = require("./zenodo");
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

  static async createPFZenodoEntry(id, name, workflow, workflowInputs, implementationUnits, steps, about, userName) {
    const getDOI = () => new Promise(async(resolve) => {
      let archive = Zip.create();
      var buffers = [];
      archive.on('readable', ()=> {
        for (;;) {
          let buffer = archive.read();
          if (!buffer) { break; }
          buffers.push(buffer);
        }
      });
      archive.on('finish', async() => {
        var buffer = Buffer.concat(buffers);
        let deposition = await Zenodo.deposit();
        await Zenodo.addToBucket(deposition.links.bucket, buffer, name+".zip");
        await Zenodo.updateMetadata(deposition.id, name, about, [{'name':'Phenoflow', 'affiliation':'King\'s College London'}, {'name': userName, 'affiliation':userName}]);
        await Zenodo.publish(deposition.id);
        let storedObject = await Zenodo.get(deposition.id);
        try {
          await models.doi.create({doi:storedObject.conceptdoi, implementationHash:ImporterUtils.hash(implementationUnits), workflowId:id});
        } catch(error) {
          logger.error("Unable to store doi: "+error);
        }
        resolve(storedObject.conceptdoi);
      });
      if(!await Download.createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, false)) resolve(false);
    });
    return await getDOI();
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

    if(visualise) {
      const timestamp="" + Math.floor(new Date() / 1000);
			const GIT_SERVER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.HOST") + config.get("gitserver.PORT");
			if(await Visualise.commitPushWorkflowRepo(id, timestamp, name, workflow, steps)) {
  			let png = await Visualise.getWorkflowPNGFromViewer(id+timestamp, name);
  			if (!png) {
  				let queueLocation = await Visualise.addWorkflowToViewer(id + timestamp, name);
  				png = await Visualise.getWorkflowFromViewer(id+timestamp, name, queueLocation);
          Zip.add(archive, png, "abstract.png");
  			}
      } else {
        logger.debug("Error creating visualisation for ZIP.");
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
