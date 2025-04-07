const fsAsync = require('fs').promises;
const logger = require('../config/winston');
const config = require('config');
const path = require('path')
const { Octokit } = require("@octokit/rest");
const { throttling } = require("@octokit/plugin-throttling");
const ThrottledOcto = Octokit.plugin(throttling);
const glob = require('fast-glob');

const Workflow = require("../util/workflow");

class Github {

  static getCommonCondition(stepA, stepB) {
    let stepASplit = stepA.split("-");
    let stepBSplit = stepB.split("-");
    let commonSubstring = [];
    for(let term=0; term<Math.min(stepASplit.length, stepBSplit.length); term+=1) {
      if(stepASplit[term]!=stepBSplit[term]) return commonSubstring.join("-");
      commonSubstring.push(stepASplit[term]);
    }
  }

  static getCodelists(steps, stepImplementations) {
    steps = steps.slice(1, steps.length-1);
    let conditions = [];
    for(let stepA of steps) {
      for(let stepB of steps) {
        let condition;
        if(condition = Github.getCommonCondition(stepA.name, stepB.name)) {
          if(!conditions.includes(condition)) conditions.push(condition);
          break;
        }
      }
    }
    
    const groupedSteps = steps.reduce((codelistSteps, step) => {
      let days;
      let groupId = (conditions.filter(condition=>step.name.startsWith(condition))[0]||conditions.filter(condition=>step.name.split("---")[0].endsWith(condition))[0]) + (step.name.includes("exclude")?"-exclude":"") + ((days = step.name.match(/\d*\-to\-\d*\-days\-after\-[A-Za-z0-9]*/))?"-"+days[0]:"");
      let containsStepName;
      if(groupId == "undefined") groupId = (containsStepName = conditions.filter(condition=>condition.includes(step.name.split("---")[0]))).length ? containsStepName[0] : null; 
      const group = (codelistSteps[groupId] || []);
      group.push(step);
      codelistSteps[groupId] = group;
      return codelistSteps;
    }, {});
    
    let codelists = {};
    for(let group of Object.keys(groupedSteps)) {
      codelists[group] = groupedSteps[group].map(function(step) {
        let codes, codeMatch;
        codes = (codeMatch = stepImplementations[step.name].match(/codes = \[(.*)\]/))?codeMatch[1]:null || 
        (codeMatch = stepImplementations[step.name].match(/codes_exclude = \[(.*)\]/))?codeMatch[1]:null || 
        (codeMatch = stepImplementations[step.name].match(/codes_after = \[(.*)\]/))?codeMatch[1]:null || 
        "";
        return JSON.parse("[" + codes + "]").map(codeSystem=>codeSystem.code+","+codeSystem.system);
      });
      codelists[group] = "code,system\n" + codelists[group].flat().join("\n")
    }
    return codelists;
  }

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
    
    if(steps && steps[0] && steps[0].type=="load") await fsAsync.copyFile("templates/replaceMe.csv", workflowRepo + "/replaceMe.csv");

    let stepImplementations = {};
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
            stepImplementations[step.name] = await fsAsync.readFile("uploads/" + step.workflowId + "/" + implementationPath + "/" + implementationFile, 'utf-8');
          } catch(copyImplementationUnitError) {
            logger.error("Error copying implementation unit: " + copyImplementationUnitError);
          }
        }
      } catch(addFileError) {
        logger.error("Failed to add file to repo: "+addFileError);
        return false;
      }
    }

    let inputType = steps[0].type;
    let readme = inputType=="load"?await fsAsync.readFile("templates/README-load.md", "utf8"):inputType=="external"?await fsAsync.readFile("templates/README-external.md", "utf8"):await fsAsync.readFile("templates/README-sub.md", "utf8");
    readme = readme.replace(/\[id\]/g, name);
    readme = readme.replace(/\[about\]/g, about);
    readme = readme.replace(/\[author\]/g, author);
    if(inputType=="external") readme = readme.replace(/\[connectorPath\]/g, (implementationUnits&&implementationUnits[steps[0].name]?implementationUnits[steps[0].name]:"other") + "/" + steps[0].fileName);
    await fsAsync.writeFile(workflowRepo + "/README.md", readme);
    let license = await fsAsync.readFile("templates/LICENSE.md", "utf8");
    license = license.replace(/\[year\]/g, new Date().getFullYear());
    await fsAsync.writeFile(workflowRepo + "/LICENSE.md", license);

    try {
      await fsAsync.mkdir(workflowRepo + "/source", {recursive:true});
    } catch(createSourceFolderError) {
      logger.error("Error creating source folder: " + createSourceFolderError);
    }
    try {
      for(let codelist of Object.entries(Github.getCodelists(steps, stepImplementations))) {
        await fsAsync.writeFile(workflowRepo + "/source/" + codelist[0] + ".csv", codelist[1]);
      }
    } catch(createCodelistsError) {
      logger.error("Error creating codelists: " + createCodelistsError);
    }
    return true;
  }

  static async getConnection() {
    let octokit;
    const accessToken = config.get("github.ACCESS_TOKEN");
    try {
      if(config.get("github.BASE_URL").includes("github.com")) {
        octokit = new ThrottledOcto({baseUrl:config.get("github.BASE_URL"), auth:accessToken, log:{debug:()=>{}, info:()=>{}, warn: console.warn, error: console.error},
          throttle: {
            onRateLimit: (retryAfter, options, octokit) => {
              octokit.log.warn(
                `Request quota exhausted for request ${options.method} ${options.url}`,
              );
        
              if(options.request.retryCount <= 2) {
                logger.info(`Retrying after ${retryAfter} seconds!`);
                return true;
              }
            },
            onSecondaryRateLimit: (retryAfter, options, octokit) => {
              octokit.log.warn(
                `Secondary quota detected for request ${options.method} ${options.url}`,
              );

              if(options.request.retryCount <= 2) {
                logger.info(`Retrying after ${retryAfter} seconds!`);
                return true;
              }
            }
          }
        });
      } else {
        octokit = new Octokit({baseUrl:config.get("github.BASE_URL"), auth:accessToken, log:{debug:()=>{}, info:()=>{}, warn: console.warn, error: console.error}});
      }
    } catch(error) {
      logger.error("Error connecting to Github: " + error);
      return false;
    }
    return octokit;
  }

  static async getRepos(org='phenoflow') {
    let octokit = await Github.getConnection();
    if(!octokit) return false;
    let allRepos = { data: [] }, page = 1, repos = [];
    try {
      do {
        repos = await octokit.repos.listForOrg({org:org, per_page:100, page:page++});
        allRepos.data = allRepos.data.concat(repos.data);
        allRepos.headers = repos.headers;
        allRepos.status = repos.status;
        allRepos.url = repos.url;
      } while(repos.data.length)
    } catch(error) {
      logger.error("Error enumerating repos for organisation (" + (repos?repos:"No repos") + ") " + org + ": " + error);
    }
    return allRepos;
  }

  static async clearAllRepos(org='phenoflow') {
    let octokit = await Github.getConnection();
    if(!octokit) return false;
    let repos = await Github.getRepos(org);
    if(!repos.data.length) return false;
    try {
      for(let repo of repos.data) {
        if(repo?.name.includes('---')) await octokit.repos.delete({owner:org, repo:repo.name});
      }
    } catch(error) {
      logger.error("Error deleting test repos: " + error);
      return false;
    }
    return true;
  }

  static async deleteRepo(id, org='phenoflow') {
    let octokit = await Github.getConnection();
    if(!octokit) return false;
    let repos = await Github.getRepos(org);
    if(!repos.data.length) return false;
    try {
      let repo = repos.data.filter(repo=>repo.name.includes(id))?.[0];
      if(repo && repo.name.includes('---')) await octokit.repos.delete({owner:org, repo:repo.name});
    } catch(error) {
      logger.error("Error deleting test repo: " + error);
      return false;
    }
    return true;
  }

  static async getBranches(name, org='phenoflow') {
    try {
      return await (await Github.getConnection()).repos.listBranches({owner:org, repo:name});
    } catch(error) {
      logger.error("Unable to get branches: " + error);
      return [];
    }
  }

  static async addZenodoWebhook(owner, repo) {
    if(!config.get('github.ZENODO_WEBHOOK')) return 
    let octokit = await Github.getConnection();
    let hookConfig = {
      'url': config.get('github.ZENODO_WEBHOOK'),
      'content_type': 'json',
      'insecure_ssl': '0'
    }
    try {
      octokit.rest.repos.createWebhook({
        owner,
        repo,
        config:hookConfig,
        events: ['release']
      });
    } catch(error) {
      logger.error("Unable to add Zenodo webhook to repo: " + error)
    }
  }

  static createRepoName(name, id) {
    return name.replaceAll("'", "") + '---' + id; 
  }

  static async createBranch(octo, org, repo, commitSha, branch) {
    try {
      // Create branch if doesn't exit (swallow exception if it does)
      await octo.git.createRef({owner:org, repo, ref:'refs/heads/'+branch, sha:commitSha});
    } catch(error) {
      logger.error(error)
    }
    return true;
  }

  static async getCurrentCommit(octo, org, repo, branch='main') {
    let refData, commitSha;
    try {
      // Exception swallowed if branch does not yet exist
      ({ data:refData } = await octo.request("GET /repos/{owner}/{repo}/git/refs/{ref}", {owner:org, repo, ref:'heads/'+branch}));
      commitSha = refData.object.sha;
    } catch(error) {
      try {
        // If branch does not yet exist, use base branch as commit reference
        ({ data:refData } = await octo.git.getRef({owner:org, repo, ref:'heads/main'}));
        commitSha = refData.object.sha;
      } catch(error) {
        logger.error("Error getting existing commit reference: " + error + ". " + JSON.stringify(refData) + " " + repo + " " + branch);
        return false;
      }
    }
    let commitData, treeSha;
    try {
      ({ data:commitData } = await octo.git.getCommit({owner:org, repo, commit_sha:commitSha}));
      treeSha = commitData.tree.sha;
    } catch(error) {
      logger.error("Error getting existing commit: " + error + ". " + JSON.stringify(commitData) + " " + org + " " + repo + " " + commitSha);
      return false;
    }
    return {commitSha, treeSha:treeSha}
  }
  
  static async getFileAsUTF8(filePath) {
    try {
      return await fsAsync.readFile(filePath, 'utf8');
    } catch(error) {
      logger.error("Error reading utf8 version of file: " + filePath);
      return false;
    }
  }

  static async updateDefaultBranch(octo, org, repo, branch) {
    try {
      await octo.repos.update({owner:org, repo:repo, default_branch:branch});
    } catch(setDefaultBranchError) {
      logger.error("Error setting default branch: " + setDefaultBranchError);
      return false;
    }
  }

  static async uploadToRepo(octo, coursePath, org, repo, branch='main', submodules=[]) {
    const currentCommit = await this.getCurrentCommit(octo, org, repo, branch);
    if(!currentCommit) return false;
    const filesPaths = await glob(coursePath+'/**/*');

    const createBlob = async(octo, org, repo, content) => {
      let blobData;
      try {
        blobData = await octo.git.createBlob({owner:org, repo, content, encoding:'utf-8'})
      } catch(error) {
        logger.error("Error creating blob: " + error + ". " + org + " " + repo + " " + content);
        return false;
      }
      return blobData.data
    }
    
    const createBlobForFile = (octo, org, repo) => async(filePath) => {
      const content = await this.getFileAsUTF8(filePath)
      if(!content) return false;
      try {
        return await createBlob(octo, org, repo, content);
      } catch(error) {
        logger.error("Error creating blob for file: " + error + " " + filePath);
        return false;
      }
    }

    const filesBlobs = await Promise.all(filesPaths.map(createBlobForFile(octo, org, repo)));
    if(!filesBlobs) return false;

    const createGitModulesBlob = async(octo, org, repo, submodules) => {
      let content = submodules.map(submodule=>'[submodule "'+submodule.name+'"]\n\tpath = '+submodule.name+'\n\turl = '+submodule.url).join('\n');
      let blobData;
      try {
        return await createBlob(octo, org, repo, content);
      } catch(error) {
        logger.error("Error creating blob: " + error + ". " + org + " " + repo + " " + JSON.stringify(submodules) + " " + content);
        return false;
      }
    }

    if(submodules.length) filesBlobs.push(await createGitModulesBlob(octo, org, repo, submodules));
    const pathsForBlobs = filesPaths.map(fullPath => path.relative(coursePath, fullPath));
    if(submodules.length) pathsForBlobs.push('.gitmodules');

    const createNewTree = async (octo, owner, repo, blobs, paths, parentTreeSha, submodules=[]) => {
      let tree = blobs.map(({ sha }, index) => ({path:paths[index], mode:'100644', type:'blob', sha}));
      if(submodules.length) tree = tree.concat(submodules.map(submodule=>({path:submodule.name, mode:'160000', type:'commit', sha:submodule.sha})));
      try {
        var { data } = await octo.git.createTree({owner, repo, tree, base_tree: parentTreeSha});
      } catch(error) {
        logger.error("Error creating tree: " + error + ". " + owner + " " + repo + " " + tree + " " + parentTreeSha);
        return false;
      }
      return data;
    }

    const newTree = await createNewTree(octo, org, repo, filesBlobs, pathsForBlobs, currentCommit.treeSha, submodules);
    if(!newTree) return false;
    const commitMessage = 'Update made by Phenoflow';

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

    const newCommit = await createNewCommit(octo, org, repo, commitMessage, newTree.sha, currentCommit.commitSha);
    if(!newCommit) return false;

    const setBranchToCommit = async(octo, org, repo, commitSha, branch='main') => {
      try {
        await this.createBranch(octo, org, repo, commitSha, branch)
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

    if(!await setBranchToCommit(octo, org, repo, newCommit.sha, branch)) return false;
    await this.updateDefaultBranch(octo, org, repo, branch);
    return newCommit.sha;
  }

  static async commit(generatedWorkflow, id, name, about, author, connector, submodules=[], restricted=false) {

    let workflowRepo = "output/" + id;
    if(!await Github.createRepositoryContent(workflowRepo, name, generatedWorkflow.generate.body.workflow, generatedWorkflow.generate.body.workflowInputs, generatedWorkflow.implementationUnits, generatedWorkflow.generate.body.steps, about, author)) {
      logger.error('Unable to create repository content.');
      return false;
    }

    const createRepo = async(octo, org, name, description, restricted=false) => { 
      try {
        await octo.repos.createInOrg({org, name, description, homepage:'https://kclhi.org/phenoflow', auto_init:true, private:restricted});
      } catch(error) {
        logger.error("Error creating repo: " + error + ". " + org + " " + name + " " + description);
        return false;
      }
      return true;
    };

    let repos = await Github.getRepos();
    let parentId = await Workflow.getParent(id);
    const repo = Github.createRepoName(name, (parentId?parentId:id));
    let octokit = await Github.getConnection();
    if(!octokit || !repos.data.length) return false;
    if (!repos.data.map((repo) => repo.name).includes(repo)) {
      if(!await createRepo(octokit, 'phenoflow', repo, about, restricted)) return false;
      Github.addZenodoWebhook('phenoflow', repo);
    }

    let sha = await this.uploadToRepo(octokit, 'output/'+id, 'phenoflow', repo, connector, submodules);
    return sha ? sha : false;

  }

  static async generateAndCommit(id, name, about, connector, username, restricted=false) {
    return await this.commit(await Workflow.generateWorkflow(id, username), id, name, about, username, connector, [], restricted)
  }

  static async generateAndCommitAll(generatedWorkflows, restricted=false) {

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
            let nestedWorkflowId = Github.createRepoName(workflowB.workflow.name, workflowB.workflow.id);
            // point parent workflow to subfolder containing nested workflow
            workflowA.generate.body.workflow = workflowA.generate.body.workflow.replace(nestedWorkflowInStep.name + '.cwl', nestedWorkflowId + '/' + workflowB.workflow.name + '.cwl');
            // point parent workflow inputs to nested workflow implementation units
            workflowA.generate.body.workflowInputs = workflowA.generate.body.workflowInputs.replaceAll(new RegExp('inputModule' + (workflowA.generate.body.steps.indexOf(nestedWorkflowInStep) + 1) +'(\-[0-9]*)?:\n  class: File\n  path: ', 'g'), '$&' + nestedWorkflowId + '/');
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
      let nestedWorkflowId = Github.createRepoName(subflow.workflow.name, subflow.workflow.id);
      subModules[subflow.workflow.id] = {'name': nestedWorkflowId, 'url': config.get("github.REPOSITORY_PREFIX") + '/' + nestedWorkflowId + '.git', 'sha': sha};
    }

    generatedYAMLWorkflows = [...new Set(parents)].concat(generatedYAMLWorkflows.filter(generatedYAMLWorkflow=>!parents.includes(generatedYAMLWorkflow) && !nested.includes(generatedYAMLWorkflow)));
    for(let generatedYAMLWorkflow of generatedYAMLWorkflows) {
      generatedYAMLWorkflow.generate.body.steps = generatedYAMLWorkflow.generate.body.steps.filter(step=>step.fileName);
      if(!await Github.commit(generatedYAMLWorkflow, generatedYAMLWorkflow.workflow.id, generatedYAMLWorkflow.workflow.name, generatedYAMLWorkflow.workflow.about, generatedYAMLWorkflow.workflow.userName, generatedYAMLWorkflow.workflow.steps[0].name, Object.keys(parentToNested).includes(generatedYAMLWorkflow.workflow.id)?parentToNested[generatedYAMLWorkflow.workflow.id].map(nested=>subModules[nested]):[], restricted)) {
        logger.error('Commit failed');
        return false;
      }
    }

    return true;

  }

}

module.exports = Github;
