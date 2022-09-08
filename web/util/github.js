const fsAsync = require('fs').promises;
const fs = require('fs');
const logger = require('../config/winston');
const git = require('isomorphic-git')

const Workflow = require("../util/workflow");

class Github {

  static async createRepositoryContent(workflowRepo, name, workflow, workflowInputs, implementationUnits, steps, about) {
    try {
      await fsAsync.mkdir(workflowRepo, {recursive:true});
    } catch(error) {
      logger.error("Error creating repo dir: " + workflowRepo + " " + JSON.stringify(error));
      return false;
    }
    try {
      await fsAsync.writeFile(workflowRepo + "/" + name + ".cwl", workflow);
    } catch(createMainWorkflowFileError) {
      logger.error("Error creating main workflow file: " + createMainWorkflowFileError);
    }
    try {
      await fsAsync.writeFile(workflowRepo + "/" + name + "-inputs.yml", workflowInputs);
    } catch(createWorkflowInputsError) {
      logger.error("Error creating workflow input file: " + createWorkflowInputsError);
    }
    
    if(steps && steps[0] && steps[0].type.indexOf("external") < 0) await fsAsync.copyFile("templates/replaceMe.csv", workflowRepo + "/replaceMe.csv");

    for(let step of steps) {
      try {
        await fsAsync.writeFile(workflowRepo + "/" + step.name + ".cwl", step.content);
      } catch(createStepFileError) {
        logger.error("Error creating step file: " + createStepFileError);
      }
      try {
        if(step.fileName) {
          let implementationPath = implementationUnits&&implementationUnits[step.name]?implementationUnits[step.name]:"other";
          let implementationFile = step.fileName;
          try {
            await fsAsync.mkdir(workflowRepo + "/" + implementationPath, {recursive:true});
          } catch(createImplementationFolderError) {
            logger.error("Error creating implementation folder: " + createImplementationFolderError);
          }
          try {
            await fsAsync.copyFile("uploads/" + step.workflowId + "/" + implementationPath + "/" + implementationFile, workflowRepo + "/" + implementationPath + "/" + implementationFile);
          } catch(copyImplementationUnitError) {
            logger.error("Error copying implementation unit: " + copyImplementationUnitError);
          }
        }
      } catch(addFileError) {
        logger.error("Failed to add file to repo: "+addFileError);
        return false;
      }
    }

    let readme = await fsAsync.readFile("templates/README.md", "utf8");
    readme = readme.replace(/\[id\]/g, name);
    readme = readme.replace(/\[about\]/g, about);
    await fsAsync.writeFile(workflowRepo + "/README.md", readme);
    let license = await fsAsync.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    await fsAsync.writeFile(workflowRepo + "/LICENSE.md", license);
    return true;
  }

  static async commit(workflowId, username) {
    
    let generatedWorkflow = await Workflow.generateWorkflow(workflowId, username);

    let workflowRepo = "output/" + workflowId;
    if(!await Github.createRepositoryContent(workflowRepo, generatedWorkflow.workflow.name, generatedWorkflow.generate.body.workflow, generatedWorkflow.generate.body.workflowInputs, generatedWorkflow.implementationUnits, generatedWorkflow.generate.body.steps, generatedWorkflow.workflow.about)) {
      logger.error('Unable to create repository content.');
      return false;
    }
    
    try {
      await git.init({fs, dir: workflowRepo})
    } catch(gitInitError) {
      logger.error('Unable to initialise local Git repository: ' + gitInitError);
      return false;
    }
    try {
      await git.add({fs, dir: workflowRepo, filepath: '.'});
    } catch(gitStageError) {
      logger.error('Unable to stage changes in local Git repository: ' + gitStageError);
    }
    try {
      let sha = await git.commit({
        fs,
        dir: workflowRepo,
        author: {
          name: "martinchapman",
          email: "contact@martinchapman.co.uk",
        },
        message: "Update"
      });
      logger.debug("SHA: " + sha);
    } catch(gitCommitError) {
      logger.error('Unable to commit to local Git repoistory: ' + gitCommitError);
    }
    

  }

}

module.exports = Github;
