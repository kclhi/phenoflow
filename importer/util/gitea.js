
const logger = require('../config/winston');
const config = require('config');
const got = require('got');
const glob = require('fast-glob');

const Github = require("./github");

class Gitea extends Github{

  static async createBranch(octo, org, repo, commitSha, branch) {
    try {
      // Create branch if doesn't exit (swallow exception if it does)
      await got.post(config.get('github.BASE_URL') + '/repos/' + org + '/' + repo + '/branches', {
        headers: {'authorization': 'token ' + config.get('github.ACCESS_TOKEN')}, 
        json: {"new_branch_name": branch}, 
        responseType: 'json'
      });
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
    } catch(error) {
      try {
        // If branch does not yet exist, use base branch as commit reference
        ({ data:refData } = await octo.request("GET /repos/{owner}/{repo}/git/refs/{ref}", {owner:org, repo, ref:'heads/main'}));
        commitSha = refData[0].object.sha;
      } catch(error) {
        logger.error("Error getting existing commit reference: " + error + ". " + JSON.stringify(refData) + " " + repo + " " + branch);
        return false;
      }
    }
    let commitData, treeSha;
    try {
      ({ data:commitData } = await octo.git.getCommit({owner:org, repo, commit_sha:commitSha}));
      treeSha = commitData.sha;
    } catch(error) {
      logger.error("Error getting existing commit: " + error + ". " + JSON.stringify(commitData) + " " + org + " " + repo + " " + commitSha);
      return false;
    }
    return {commitSha, treeSha:treeSha}
  }

  static async uploadToRepo(octo, coursePath, org, repo, branch='main', submodules=[]) {
    if(!submodules.length) {
      const sha = (await this.getCurrentCommit(octo, org, repo, branch)).commitSha;
      await this.createBranch(octo, org, repo, sha, branch);
      const filesPaths = await glob(coursePath+'/**/*');
      const commitMessage = 'Update made by Phenoflow';
      const createOrUpdateFile = async(path, content) => { 
        let response;
        try {
          let url = config.get('github.BASE_URL') + '/repos/' + org + '/' + repo + '/contents/' + encodeURIComponent(path);
          let headers = {'authorization': 'token ' + config.get('github.ACCESS_TOKEN')};
          let json = {message:commitMessage, content:content, branch:branch};
          try {
            response = await got.post(url, {headers:headers, json:json, responseType:'json'});
          } catch (postError) {
            json.sha = (await octo.rest.repos.getContent({owner:org, repo:repo, path:path})).data.sha
            response = await got.put(url, {headers:headers, json:json, responseType:'json'});
          }
        } catch(error) {
          logger.error("Error uploading to repo: " + error + " " + (response && response.body ? JSON.stringify(response.body) : "") + ". " + path + " " + org);
          return false;
        }
        return true;
      };
      for(let path of filesPaths) {
        let content = btoa(await this.getFileAsUTF8(path));
        await createOrUpdateFile(path.replaceAll(coursePath + '/', ''), content)
      }
      await this.updateDefaultBranch(octo, org, repo, branch);
    } 
  }

}

module.exports = Gitea;
