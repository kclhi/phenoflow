const logger = require('../config/winston');
const config = require('config');
const parse = require('neat-csv');
const fs = require('fs').promises;

class Importer {

  static async openCSV(path, file) {

    let csvFile, csv;
    try {
      csvFile = await fs.readFile(path+file);
    } catch(error) {
      console.error("Could not read codelist "+file+": "+error);
    }
    try {
      csv = await parse(csvFile);
    } catch(error) {
      console.error(error);
    }
    return csv;
  
  }

}

module.exports = Importer;
