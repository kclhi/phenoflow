const fspromises = require('fs').promises;
const git = require('isomorphic-git')
const fs = require('fs');
const http = require('isomorphic-git/http/node')
const got = require('got');
const logger = require('../config/winston');
const config = require('config');
const Zip = require("./zip");

class Utils {

  static async commitPushWorkflowRepo(id, timestamp, name, workflow, steps) {

    const GIT_SERVER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.HOST") + config.get("gitserver.PORT");
    let workflowRepo = "output/" + id;

    try {
      await fspromises.mkdir(workflowRepo, {recursive:true});
    } catch(error) {
      logger.error("Error creating repo dir: " + workflowRepo + " " + JSON.stringify(error));
    }

    await fspromises.writeFile(workflowRepo + "/" + name + ".cwl", workflow);
    for ( const step in steps ) await fspromises.writeFile(workflowRepo + "/" + steps[step].name + ".cwl", steps[step].content);

    await git.init({fs, dir: workflowRepo})
    await git.add({fs, dir: workflowRepo, filepath: '.'})

    let sha = await git.commit({
      fs,
      dir: workflowRepo,
      author: {
        name: "martinchapman",
        email: "contact@martinchapman.co.uk",
      },
      message: "visualisation"
    });
    logger.debug("SHA: " + sha);

    try {
      let addRemoteResult = await git.addRemote({
        fs,
        dir: workflowRepo,
        remote: "workflow" + id + timestamp,
        url: GIT_SERVER_URL + "/workflow" + id + timestamp + ".git"
      });
    } catch(error) {
      logger.debug("Cannot add remote (" + workflow + id + timestamp + "): " + error);
    }

    try {
      let pushResult = await git.push({
        fs,
        http,
        dir: workflowRepo,
        remote: "workflow" + id + timestamp,
        ref: "master"
      });
      logger.debug("Pushed to: " + id + timestamp);
    } catch(error) {
      logger.debug("Cannot push to remote (" + id + timestamp + "): " + error);
    }



  }

  static async getWorkflowPNGFromViewer(id, file) {

    const urlSuffix = config.get("gitserver.CONTAINER_HOST") + config.get("gitserver.PORT") + "/workflow" + id + ".git/master/" + file + ".cwl"

    try {
      const pngPromise = got.get(config.get("visualiser.URL") + "/graph/png/" + urlSuffix, {timeout: 120000, followRedirect: false});
	    const pngBufferPromise = pngPromise.buffer();
      var [png, pngBuffer] = await Promise.all([pngPromise, pngBufferPromise]);
    } catch (error) {
      logger.debug("Failed to get PNG: " + urlSuffix + " " + error);
      return null;
    }

    logger.debug("Response from get workflow png from viewer: " + png.statusCode);

    if (png.statusCode==200 && pngBuffer) {
      return pngBuffer;
    } else {
      return null;
    }

  }

  static async addWorkflowToViewer(id, file) {

    const GIT_CONTAINER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.CONTAINER_HOST") + config.get("gitserver.PORT");

    try {
      var generate = await got.post(config.get("visualiser.URL") + "/workflows", {
        headers: {'user-agent': 'pf/0.0.1', 'accept':'application/json'},
        form: {
          url: GIT_CONTAINER_URL + "/workflow" + id + ".git",
          branch: "master",
          path: file + ".cwl"
        },
        timeout: 120000
      });
    } catch (error) {
      logger.debug("Failed to add workflow to viewer: " + id + " " + file + " " + error);
      return null;
    }

    logger.debug("Response from add workflow to viewer: " + JSON.stringify(generate.headers) + " " + JSON.stringify(generate.body));

    if (generate && generate.headers && generate.headers.location) {
      return generate.headers.location;
    } else if (generate && generate.body && JSON.parse(generate.body).visualisationPng) {
      return await Utils.getWorkflowPNGFromViewer(id, file);
    } else {
      return null;
    }

  }

  static async getWorkflowFromViewer(id, file, queueLocation, remainingTries=10) {

    if (!queueLocation || (queueLocation && queueLocation.indexOf("queue")==-1)) {
      logger.debug("No queue location specified");
      return null;
    }

    let options = {headers: {'user-agent': 'pf/0.0.1', 'accept':'application/json'}, timeout: 120000, followRedirect: false};

    try {
      var queue = await got.get(config.get("visualiser.URL") + queueLocation, options);
    } catch (error) {
      logger.debug("Failed to get queue information: " + error);
      return null;
    }

    logger.debug("Response from get workflow from viewer: " + queue.statusCode + " " + JSON.stringify(queue.body));

    if (queue && queue.statusCode==200 && queue.body && JSON.parse(queue.body).cwltoolStatus=="RUNNING" && remainingTries>0) {
      logger.debug("Visualisation still processing, trying again.");
      await new Promise(resolve=>setTimeout(resolve, 1000));
      return await Utils.getWorkflowFromViewer(id, file, queueLocation, remainingTries-1);
    } else if (queue && queue.statusCode==303 && queue.body && JSON.parse(queue.body).cwltoolStatus=="SUCCESS") {
      logger.debug("Visualisation processed, getting PNG.");
      return await Utils.getWorkflowPNGFromViewer(id, file);
    } else {
      return null;
    }

  }

  static async createPFZipFile(id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise=false) {

    let archive = await Zip.createFile(name);
    await Utils.createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise)

  }

  static async createPFZipResponse(res, id, name, workflow, workflowInputs, implementationUnits, steps, about) {

    let archive = await Zip.createResponse(name, res);
    await Utils.createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, true)

  }

  static async createPFZip(archive, id, name, workflow, workflowInputs, implementationUnits, steps, about, visualise) {

    await Zip.add(archive, workflow, name + ".cwl");
    await Zip.add(archive, workflowInputs, name + "-inputs.yml");
    await Zip.add(archive, "", "replaceMe.csv");

    for ( const step in steps ) {
      await Zip.add(archive, steps[step].content, steps[step].name + ".cwl");
      await Zip.addFile(archive, "uploads/", (implementationUnits[steps[step].name]?implementationUnits[steps[step].name]:implementationUnits) + "/" + steps[step].fileName);
    }

    if (visualise) {
      const timestamp="" + Math.floor(new Date() / 1000);
			const GIT_SERVER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.HOST") + config.get("gitserver.PORT");
			await Utils.commitPushWorkflowRepo(id, timestamp, name, workflow, steps);
			let png = await Utils.getWorkflowPNGFromViewer(id + timestamp, name);
			if (!png) {
				let queueLocation = await Utils.addWorkflowToViewer(id + timestamp, name);
				png = await Utils.getWorkflowFromViewer(id + timestamp, name, queueLocation);
        await Zip.add(archive, png, "abstract.png");
			}
		}

    let readme = await fspromises.readFile("templates/README.md", "utf8");
    readme = readme.replace(/\[id\]/g, name);
    readme = readme.replace(/\[about\]/g, about);
    await Zip.add(archive, readme, "README.md");
    let license = await fspromises.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    await Zip.add(archive, license, "LICENSE.md");
    await Zip.output(archive);

  }

}

module.exports = Utils;
