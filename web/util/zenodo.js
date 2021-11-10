const got = require('got');
const Zip = require('./zip');
const logger = require('../config/winston');
const config = require('config');

class Zenodo {

  static async deposit() {
    let deposition;
    try {
      deposition = await got.post('https://'+config.get('zenodo.URL')+'/api/deposit/depositions', {
        searchParams:{'access_token':config.get('zenodo.ACCESS_TOKEN')},
        json:{}, 
        responseType:'json'
      });
    } catch(error) {
      logger.error('Error setting up Zenodo deposit: '+error.message);
      return;
    }
    return deposition.body;
  }

  static async addToBucket(bucket, content, fileName) {
    let res;
    try {
      res = await got.put(bucket+'/'+fileName, {
        searchParams:{'access_token':config.get('zenodo.ACCESS_TOKEN')},
        body: content
      });
    } catch(error) {
      logger.error('Error uploading to Zenodo: '+error.message);
    }
    logger.debug(res.body);
  }

  static async updateMetadata(depositId, title, description, creators) {
    let data = {
      'metadata': {
        'title': title,
        'upload_type': 'software',
        'description': description,
        'creators': creators
      }
    };
    let res;
    try {
      res = await got.put('https://'+config.get('zenodo.URL')+'/api/deposit/depositions/'+depositId, {
        searchParams:{'access_token':config.get('zenodo.ACCESS_TOKEN')}, 
        json:data,
      });
    } catch(error) {
      logger.error('Error uploading deposit metadata on Zenodo: '+error.message);
    }
    logger.debug(res.body);
  }

  static async publish(depositId) {
    let res;
    try {
      res = await got.post('https://'+config.get('zenodo.URL')+'/api/deposit/depositions/'+depositId+'/actions/publish', {
        searchParams:{'access_token':config.get('zenodo.ACCESS_TOKEN')}
      });
    } catch(error) {
      logger.error('Error publishing Zenodo upload: '+error.message);
    }
    logger.debug(res.body);
  }

  static async get(depositId) {
    let res;
    try {
      res = await got.get('https://'+config.get('zenodo.URL')+'/api/deposit/depositions/'+depositId, {
        searchParams:{'access_token':config.get('zenodo.ACCESS_TOKEN')},
        responseType: 'json'
      });
    } catch(error) {
      logger.error('Error getting Zenodo upload: '+error.message);
    }
    return res.body;
  }

}

module.exports = Zenodo;
