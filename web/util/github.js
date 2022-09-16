const fsAsync = require('fs').promises;
const fs = require('fs');
const logger = require('../config/winston');
const config = require('config');
const path = require('path')
const { Octokit } = require("@octokit/rest");
const glob = require('fast-glob');


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
          if(implementationPath=="other") {
            logger.warn("'Other' language path used for step: " + JSON.stringify(step) + ". Implementation units: " + JSON.stringify(implementationUnits));
          }
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

  static async commit(id, name, about, connector, username) {
    
    let generatedWorkflow = await Workflow.generateWorkflow(id, username);

    let workflowRepo = "output/" + id;
    if(!await Github.createRepositoryContent(workflowRepo, generatedWorkflow.workflow.name, generatedWorkflow.generate.body.workflow, generatedWorkflow.generate.body.workflowInputs, generatedWorkflow.implementationUnits, generatedWorkflow.generate.body.steps, generatedWorkflow.workflow.about)) {
      logger.error('Unable to create repository content.');
      return false;
    }
    
    //

    const getCurrentCommit = async (octo, org, repo, branch='main') => {
      let refData;
      try {
        // Exception swalled if branch does not yet exist
        ({ data:refData } = await octo.git.getRef({owner:org, repo, ref:'heads/'+branch}));
      } catch(error) {
        try {
          // If branch does not yet exist, use base branch as commit reference
          ({ data:refData } = await octo.git.getRef({owner:org, repo, ref:'heads/main'}));
        } catch(error) {
          logger.error("Error getting existing commit reference: " + error + ". " + repo + " " + branch);
          return false;
        }
      }
      const commitSha = refData.object.sha;
      let commitData;
      try {
        ({ data:commitData } = await octo.git.getCommit({owner:org, repo, commit_sha:commitSha}));
      } catch(error) {
        logger.error("Error getting existing commit: " + error + ". " + org + " " + repo + " " + commitSha);
        return false;
      }
      return {commitSha, treeSha:commitData.tree.sha}
    }

    const getFileAsUTF8 = async(filePath) => {
      try {
        return await fsAsync.readFile(filePath, 'utf8');
      } catch(exception) {
        logger.error("Error reading utf8 version of file: " + filePath);
        return false;
      }
    }

    const createBlobForFile = (octo, org, repo) => async(filePath) => {
      const content = await getFileAsUTF8(filePath)
      if(!content) return false;
      let blobData;
      try {
        blobData = await octo.git.createBlob({owner:org, repo, content, encoding:'utf-8'})
      } catch(exception) {
        logger.error("Error creating blob: " + exception + ". " + org + " " + repo + " " + filePath + " " + content);
        return false;
      }
      return blobData.data
    }
    
    const createNewTree = async (octo, owner, repo, blobs, paths, parentTreeSha) => {
      const tree = blobs.map(({ sha }, index) => ({path:paths[index], mode:'100644', type:'blob', sha}));
      try {
        var { data } = await octo.git.createTree({owner, repo, tree, base_tree: parentTreeSha});
      } catch(error) {
        logger.error("Error creating tree: " + exception + ". " + owner + " " + repo + " " + tree + " " + parentTreeSha);
        return false;
      }
      return data;
    }

    const createNewCommit = async(octo, org, repo, message, currentTreeSha, currentCommitSha) => {
      let newCommit;
      try {
        newCommit = await octo.git.createCommit({owner: org, repo, message, tree:currentTreeSha, parents:[currentCommitSha]});
      } catch(error) {
        logger.error("Unable to create commit: " + error + ". " + org + " " + repo + " " + message + " " + currentTreeSha + " " + currentCommitSha);
        return false;
      }
      return newCommit.data;
    } 

    const setBranchToCommit = async(octo, org, repo, commitSha, branch='main') => {
      try {
        // Create branch if doesn't exit (swallow exception if it does)
        await octo.git.createRef({owner:org, repo, ref:'refs/heads/'+branch, sha:commitSha});
      } catch(error) {
        try {
          await octo.git.updateRef({owner:org, repo, ref:'heads/'+branch, sha:commitSha});
        } catch(error) {
          logger.error("Unable to commit to branch: " + error + ". " + org + " " + repo + " " + branch + " " + commitSha);
          return false;
        }
      }
      return true;
    };

    const uploadToRepo = async (octo, coursePath, org, repo, branch='main') => {
      const currentCommit = await getCurrentCommit(octo, org, repo, branch);
      if(!currentCommit) return false;
      const filesPaths = await glob(coursePath+'/**/*');
      const filesBlobs = await Promise.all(filesPaths.map(createBlobForFile(octo, org, repo)));
      if(!filesBlobs) return false;
      const pathsForBlobs = filesPaths.map(fullPath => path.relative(coursePath, fullPath));
      const newTree = await createNewTree(octo, org, repo, filesBlobs, pathsForBlobs, currentCommit.treeSha);
      if(!newTree) return false;
      const commitMessage = 'My commit message';
      const newCommit = await createNewCommit(octo, org, repo, commitMessage, newTree.sha, currentCommit.commitSha);
      if(!newCommit) return false;
      if(!await setBranchToCommit(octo, org, repo, newCommit.sha, branch)) return false;
      return true;
    }

    const createRepo = async(octo, org, name, description) => { 
      try {
        await octo.repos.createInOrg({org, name, description, auto_init:true});
      } catch(error) {
        logger.error("Error creating repo: " + error + ". " + org + " " + name + " " + description);
        return false;
      }
      return true;
    };

    const accessToken = config.get("github.ACCESS_TOKEN");
    const octokit = new Octokit({auth:accessToken});
    const repo = about.replace(/ /g, '-').toLowerCase();
    let repos;
    try {
      repos = await octokit.repos.listForOrg({org:'phenoflow'});
    } catch(error) {
      logger.error("Error enumerating repos: " + error);
      return false;
    }

    if (!repos.data.map((repo) => repo.name).includes(repo)) if(!await createRepo(octokit, 'phenoflow', repo, about)) return false;

    await uploadToRepo(octokit, 'output/'+id, 'phenoflow', repo, connector);

  }

}

module.exports = Github;
