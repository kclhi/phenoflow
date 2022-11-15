const fsAsync = require('fs').promises;
const fs = require('fs');
const logger = require('../config/winston');
const config = require('config');
const path = require('path')
const { Octokit } = require("@octokit/rest");
const glob = require('fast-glob');

const Workflow = require("../util/workflow");

class Github {

  static async createRepositoryContent(workflowRepo, name, workflow, workflowInputs, implementationUnits, steps, about, author) {
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
    readme = readme.replace(/\[author\]/g, author);
    await fsAsync.writeFile(workflowRepo + "/README.md", readme);
    let license = await fsAsync.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    await fsAsync.writeFile(workflowRepo + "/LICENSE.md", license);
    return true;
  }

  static async getConnection() {
    let octokit;
    const accessToken = config.get("github.ACCESS_TOKEN");
    try {
      octokit = new Octokit({baseUrl:config.get("github.BASE_URL"), auth:accessToken});
    } catch(error) {
      logger.error("Error connecting to Github: " + error);
      return false;
    }
    return octokit;
  }

  static async getRepos(org='phenoflow') {
    let octokit = await Github.getConnection();
    if(!octokit) return false;
    let repos;
    try {
      repos = await octokit.repos.listForOrg({org:org});
    } catch(error) {
      logger.error("Error enumerating repos: " + error);
      return false;
    }
    return repos;
  }

  static async clearAllRepos(org='phenoflow') {
    let octokit = await Github.getConnection();
    if(!octokit) return false;
    let repos = await Github.getRepos(org);
    if(!repos) return false;
    try {
      for(let repo of repos.data) {
        await octokit.repos.delete({owner:org, repo:repo.name});
      }
    } catch(error) {
      logger.error("Error deleting test repos: " + error);
      return false;
    }
    return true;
  }

  static async commit(generatedWorkflow, id, name, about, author, connector, submodules=[]) {

    let workflowRepo = "output/" + id;
    if(!await Github.createRepositoryContent(workflowRepo, name, generatedWorkflow.generate.body.workflow, generatedWorkflow.generate.body.workflowInputs, generatedWorkflow.implementationUnits, generatedWorkflow.generate.body.steps, about, author)) {
      logger.error('Unable to create repository content.');
      return false;
    }
    
    //

    const getCurrentCommit = async (octo, org, repo, branch='main') => {
      let refData;
      try {
        // Exception swallowed if branch does not yet exist
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

    const createBlob = async(octo, org, repo, content) => {
      let blobData;
      try {
        blobData = await octo.git.createBlob({owner:org, repo, content, encoding:'utf-8'})
      } catch(exception) {
        logger.error("Error creating blob: " + exception + ". " + org + " " + repo + " " + content);
        return false;
      }
      return blobData.data
    }

    const createBlobForFile = (octo, org, repo) => async(filePath) => {
      const content = await getFileAsUTF8(filePath)
      if(!content) return false;
      try {
        return await createBlob(octo, org, repo, content);
      } catch(exception) {
        logger.error("Error creating blob for file: " + exception + " " + filePath);
        return false;
      }
    }
    
    const createNewTree = async (octo, owner, repo, blobs, paths, parentTreeSha, submodules=[]) => {
      let tree = blobs.map(({ sha }, index) => ({path:paths[index], mode:'100644', type:'blob', sha}));
      if(submodules.length) tree = tree.concat(submodules.map(submodule=>({path:submodule.name, mode:'160000', type:'commit', sha:submodule.sha})));
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

    const createGitModulesBlob = async(octo, org, repo, submodules) => {
      let content = submodules.map(submodule=>'[submodule "'+submodule.name+'"]\n\tpath = '+submodule.name+'\n\turl = '+submodule.url).join('\n');
      let blobData;
      try {
        return await createBlob(octo, org, repo, content);
      } catch(exception) {
        logger.error("Error creating blob: " + exception + ". " + org + " " + repo + " " + JSON.stringify(submodules) + " " + content);
        return false;
      }
    }

    const uploadToRepo = async (octo, coursePath, org, repo, branch='main', submodules=[]) => {
      const currentCommit = await getCurrentCommit(octo, org, repo, branch);
      if(!currentCommit) return false;
      const filesPaths = await glob(coursePath+'/**/*');
      const filesBlobs = await Promise.all(filesPaths.map(createBlobForFile(octo, org, repo)));
      if(!filesBlobs) return false;
      if(submodules.length) filesBlobs.push(await createGitModulesBlob(octo, org, repo, submodules));
      const pathsForBlobs = filesPaths.map(fullPath => path.relative(coursePath, fullPath));
      if(submodules.length) pathsForBlobs.push('.gitmodules');
      const newTree = await createNewTree(octo, org, repo, filesBlobs, pathsForBlobs, currentCommit.treeSha, submodules);
      if(!newTree) return false;
      const commitMessage = 'My commit message';
      const newCommit = await createNewCommit(octo, org, repo, commitMessage, newTree.sha, currentCommit.commitSha);
      if(!newCommit) return false;
      if(!await setBranchToCommit(octo, org, repo, newCommit.sha, branch)) return false;
      try {
        await octokit.repos.update({owner:org, repo:repo, default_branch:branch});
      } catch(setDefaultBranchError) {
        logger.error("Error setting default branch: " + setDefaultBranchError);
        return false;
      }
      return newCommit.sha;
    }

    const createRepo = async(octo, org, name, description) => { 
      try {
        await octo.repos.createInOrg({org, name, description, homepage:'https://kclhi.org/phenoflow', auto_init:true});
      } catch(error) {
        logger.error("Error creating repo: " + error + ". " + org + " " + name + " " + description);
        return false;
      }
      return true;
    };

    let repos = await Github.getRepos();
    const repo = about.replace(/ /g, '-').toLowerCase();
    let octokit = await Github.getConnection();
    if(!octokit || !repos) return false;
    if (!repos.data.map((repo) => repo.name).includes(repo)) if(!await createRepo(octokit, 'phenoflow', repo, about)) return false;

    let sha = await uploadToRepo(octokit, 'output/'+id, 'phenoflow', repo, connector, submodules);
    return sha ? sha : false;

  }

  static async generateAndCommit(id, name, about, connector, username) {
    return await this.commit(await Workflow.generateWorkflow(id, username), name, about, username, connector)
  }

  static async generateAndCommitAll(generatedWorkflows) {

    let generatedYAMLWorkflows = [];
    for(let workflow of generatedWorkflows) {
      generatedYAMLWorkflows.push(await Workflow.generateWorkflow(workflow.id,  workflow.userName));
    }

    let parents = [], nested = [];
    let parentToNested = {};
    for(let workflowA of generatedYAMLWorkflows) {
      for(let workflowB of generatedYAMLWorkflows) {
        if(workflowA.workflow.id==workflowB.workflow.id || nested.map(workflow=>workflow.workflow.id).includes(workflowA.workflow.id)) continue;
        let workflowBContent = workflowB.generate.body.workflow;
        for(let nestedWorkflowInStep of workflowA.generate.body.steps.filter(step=>!step.fileName)) {
          // if nested workflow represented by other passed workflow
          if(nestedWorkflowInStep.content.replaceAll('\n', '').replace(/outputs:\s*\w*:\s*id:\s*\w*/,'')==workflowBContent.replaceAll('\n', '').replace(/outputs:\s*\w*:\s*id:\s*\w*/,'')) {
            let nestedWorkflowId = workflowB.workflow.about.replace(/ /g, '-').toLowerCase();
            // point parent workflow to subfolder containing nested workflow
            workflowA.generate.body.workflow = workflowA.generate.body.workflow.replace(nestedWorkflowInStep.name, nestedWorkflowId + '/' + workflowB.workflow.name);
            // point parent workflow inputs to nested workflow implementation units
            workflowA.generate.body.workflowInputs = workflowA.generate.body.workflowInputs.replaceAll(/inputModule\d\-\d:\n  class: File\n  path: /g, '$&' + nestedWorkflowId + '/');
            // change nested workflow to be part of parent workflow, as opposed to outputting dedicated cases
            workflowB.generate.body.workflow = workflowBContent.replace('outputs:\n  cases:\n    id: cases', 'outputs:\n  output:\n    id: output');
            parents.push(workflowA);
            nested.push(workflowB);
            parentToNested[workflowA.workflow.id] = Object.keys(parentToNested).includes(workflowA.workflow.id) ? parentToNested[workflowA.workflow.id].concat([workflowB.workflow.id]) : [workflowB.workflow.id];
          }
        }
      }
    }

    // commit subflows first to retrieve SHAs to be used to create submodule references in parent(s)
    let subModules = {};
    for(let subflow of new Set(nested)) {
      // assume subflows don't have connectors of their own
      let sha = await Github.commit(subflow, subflow.workflow.id, subflow.workflow.name, subflow.workflow.about, subflow.workflow.userName, 'main');
      if(!sha) return false;
      let nestedWorkflowId = subflow.workflow.about.replace(/ /g, '-').toLowerCase();
      subModules[subflow.workflow.id] = {'name': nestedWorkflowId, 'url': config.get("github.ORGANISATION_SSH") + '/' + nestedWorkflowId + '.git', 'sha': sha};
    }

    generatedYAMLWorkflows = parents.concat(generatedYAMLWorkflows.filter(generatedYAMLWorkflow=>!parents.includes(generatedYAMLWorkflow) && !nested.includes(generatedYAMLWorkflow)));
    for(let generatedYAMLWorkflow of generatedYAMLWorkflows) {
      if(!await Github.commit(generatedYAMLWorkflow, generatedYAMLWorkflow.workflow.id, generatedYAMLWorkflow.workflow.name, generatedYAMLWorkflow.workflow.about, generatedYAMLWorkflow.workflow.userName, generatedYAMLWorkflow.workflow.steps[0].name, Object.keys(parentToNested).includes(generatedYAMLWorkflow.workflow.id)?parentToNested[generatedYAMLWorkflow.workflow.id].map(nested=>subModules[nested]):[])) return false;
    }

    return true;

  }

}

module.exports = Github;
