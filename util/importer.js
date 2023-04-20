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

  static clean(input, spaces=false) {
    input = input.replace(/\//g, "").replace(/(\s)?\(.*\)/g, "").replace(/\,/g, "").replace(/&amp;/g, "and");
    if(!spaces) input = input.replace(/ /g, "-");
    return input;
  }
  
  static hash(filesContent) {
    return require('crypto').createHash('sha1').update(JSON.stringify(filesContent)).digest('base64').replace(/[^A-Za-z0-9]/g, "");
  }

  static steplistHash(stepList, allCSVs) {
    let csvs=[];
    for(let row of stepList.content) {
      if(row["logicType"]=="codelist"||row["logicType"]=="codelistExclude") {
        let file = row["param"].split(":")[0];
        csvs.push(allCSVs.filter(csv=>csv.filename==file)[0]);
      } else if(row["logicType"]=="codelistsTemporal") {
        for(let file of [row["param"].split(":")[0], row["param"].split(":")[1]]) csvs.push(allCSVs.filter(csv=>csv.filename==file)[0]);
      } else if(row["logicType"]=="branch") {
        csvs.push({filename:row["param"], content:this.steplistHash(allCSVs.filter(csv=>csv.filename==row["param"])[0], allCSVs)});
      }
    }
    let uniqueCSVs = csvs.filter(({filename}, index)=>!csvs.map(csv=>csv.filename).includes(filename, index+1));
    return this.hash(uniqueCSVs.map(csv=>csv.content));
  }

  static getName(file) {
    let name = file.split("_")[0].split("-"); 
    if(name[name.length-1].match(/[0-9]*/)>0) name.pop();
    name[0] = name[0].charAt(0).toUpperCase() + name[0].substring(1);
    return name.join(" ").replace(".csv","");
  }

}

module.exports = Importer;
