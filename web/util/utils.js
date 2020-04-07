const fspromises = require('fs').promises;
const git = require('isomorphic-git')
const fs = require('fs');
const http = require('isomorphic-git/http/node')
const request = require('request');
const logger = require('../config/winston');
const config = require('config');
const Zip = require("./zip");

class Utils {

  static async commitPushWorkflowRepo(id, name, workflow, steps) {

    const GIT_SERVER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.HOST") + config.get("gitserver.PORT");
    let workflowRepo = "output/" + id;

    try {
      await fspromises.mkdir(workflowRepo, {recursive:true});
    } catch(error) {
      logger.error("Error creating repo dir: " + workflowRepo + " " + JSON.stringify(error));
    }

    await fspromises.writeFile(workflowRepo + "/" + name + ".cwl", workflow);
    for ( const step in steps ) await fspromises.writeFile(workflowRepo + "/" + steps[step].stepId + ".cwl", steps[step].content);


    await git.init({ fs, dir: workflowRepo })
    await git.add({ fs, dir: workflowRepo, filepath: '.' })
    let sha = await git.commit({
      fs,
      dir: workflowRepo,
      author: {
        name: "martinchapman",
        email: "contact@martinchapman.co.uk",
      },
      message: "visualisation"
    });
    await git.addRemote({
      fs,
      dir: workflowRepo,
      remote: "workflow" + id,
      url: GIT_SERVER_URL + "/workflow" + id + ".git"
    })
    let pushResult = await git.push({
      fs,
      http,
      dir: workflowRepo,
      remote: "workflow" + id,
      ref: "master"
    })
    logger.debug(pushResult)

  }

 static async addWorkflowToViewer(id, file, processQueueLocation=function(queueId){}) {

    const GIT_CONTAINER_URL = config.get("gitserver.PREFIX") + config.get("gitserver.CONTAINER_HOST") + config.get("gitserver.PORT");

    request.post(config.get("visualiser.URL") + "/workflows", {
      headers: {'accept':'application/json'},
      form: {
        url: GIT_CONTAINER_URL + "/workflow" + id + ".git",
        branch: "master",
        path: file + ".cwl"
      },
      timeout: 120000
    }, function(error, response, data) {

      logger.debug("CWL visualisation server generate response: " + JSON.stringify(response) + " " + error + " " + data);
      let location;

      if (!error && response && response.headers && (location = response.headers.location) ) {
        processQueueLocation(location);
      } else {
        processQueueLocation(null);
      }

    });

  }

  static async getWorkflowFromViewer(id, file, queueLocation, procesPNG=function(png){}) {

    if (!queueLocation) procesPNG(null);
    let options = {headers: {'user-agent': 'my-app/0.0.1', 'accept':'application/json'}, timeout: 120000, followRedirect: false};
    let urlSuffix = config.get("gitserver.CONTAINER_HOST") + config.get("gitserver.PORT") + "/workflow" + id + ".git/master/" + file + ".cwl"

    request.get(config.get("visualiser.URL") + queueLocation, options, function(error, response, data) {

      logger.debug("CWL queue response: " + JSON.stringify(response) + " " + error + " " + data);

      let toolStatus;
      if (response && response.statusCode==200 && response.body && (toolStatus=JSON.parse(response.body).cwltoolStatus) && toolStatus=="RUNNING") {
        logger.debug("Visualisation still processing, trying again.");
        setTimeout(()=>Utils.getWorkflowFromViewer(id, file, queueLocation, procesPNG), 1000);
        return;
      } else if (response && response.statusCode==303 && response.body && (toolStatus=JSON.parse(response.body).cwltoolStatus) && toolStatus=="SUCCESS") {

        request.get(config.get("visualiser.URL") + "/graph/png/" + urlSuffix, {timeout: 120000, followRedirect: false}, function(error, response, data) {

          logger.debug("CWL visualisation server get PNG response: " + JSON.stringify(response) + " " + error + " " + data);

          if (!error && response.statusCode == 200 && response.body) {
            procesPNG(response.body);
          } else {
            procesPNG(null);
          }

        });

      } else {
        procesPNG(null);
      }

    });

  }

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
