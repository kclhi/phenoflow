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

  static async hashFiles(path, files) {

    let filesContent="";
    for(let file of files) filesContent+=await fs.readFile(path+file);
    return require('crypto').createHash('sha1').update(filesContent).digest('base64').replace(/[^A-Za-z0-9]/g, "");

  }

  static getName(file) {

    let name = file.split("_")[0].split("-"); 
    if(name[name.length-1].match(/[0-9]*/)>0) name.pop();
    name[0] = name[0].charAt(0).toUpperCase() + name[0].substring(1);
    return name.join(" ");
  
  }

}

module.exports = Importer;
