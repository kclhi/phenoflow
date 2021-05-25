const chai = require("chai");
chai.use(require("chai-http"));
const server = require("../app");
const should = chai.should();
const expect = chai.expect;
const proxyquire = require('proxyquire');
const nlp = require('compromise');
const fsfull = require("fs");
const fs = require("fs").promises;
const m2js = require("markdown-to-json");
const parse = require('neat-csv');
const config = require("config");
const stringSimilarity = require("string-similarity");
const natural = require("natural");
const stemmer = natural.PorterStemmer;

class Importer {

  static async importPhenotype(name, about, codeCategories, userName) {
    const server = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
    let res = await chai.request(server).post("/phenoflow/importer").send({name:name, about:about, codeCategories:codeCategories, userName:userName});
    res.should.have.status(200);
    res.body.should.be.a("object");
    return true;
  }

  static categorise(code, description, codeCategories, name, primary=true) {
    let placed=false;
    let primarySecondary = primary?" - primary":" - secondary";
    function orderKey(key) {
      // Don't attempt reorder on more than two words
      let keyTerms = key.split(" ");
      if(keyTerms.length!=2) return key.charAt(0).toUpperCase() + key.slice(1);
      let nlpKey = nlp(key);
      let adjectives = nlpKey.adjectives()?nlpKey.adjectives().out("text").split(" "):null;
      let nouns = nlpKey.nouns()?nlpKey.nouns().out("text").split(" "):null;
      // Adjectives first; both nouns, condition first
      if(adjectives&&adjectives.length==1&&adjectives[0]!=keyTerms[0]
        ||nouns&&nouns.length==2&&name!=keyTerms[0]) {
          key=keyTerms[1].toLowerCase();
          key+=" "+keyTerms[0].toLowerCase();
      }
      key=key.charAt(0).toUpperCase() + key.slice(1);
      return key;
    }
    function clean(input) {
      if(!input) throw "Trying to clean empty input:"+code+" "+description+" "+name;
      return input.toLowerCase().replace(/[^a-zA-Z]/g, "");
    }
    for(let existingCategory of Object.keys(codeCategories)) {
      // Don't mix primary and secondary category groups
      if(primary&&!existingCategory.includes("primary")) continue; 
      // If description is just the name of the condition itself
      if(name==description.toLowerCase()) {
        codeCategories[existingCategory].push(code);
        placed=true;
        break;
      }
      let existingCategoryPrefix = existingCategory.toLowerCase().replace(primarySecondary, "").replace(name.toLowerCase(), "").trim();
      for(let term of description.trim().replace("  ", " ").split(" ")) {
        term = clean(nlp(term).nouns().toSingular().text() || term);
        // Don't consider terms that are the condition itself
        if(name.split(" ").map(word=>stemmer.stem(word).toLowerCase()).includes(stemmer.stem(term))) continue;
        if((existingCategoryPrefix.includes(term)
        || term.includes(existingCategoryPrefix)
        || stringSimilarity.compareTwoStrings(term, existingCategoryPrefix) >= 0.8
        ) && term.length > 4) {
          codeCategories[existingCategory].push(code);
          if(term!=existingCategoryPrefix.toLowerCase()) {
            let suffix = (!term.includes(clean(name))&&!clean(name).includes(term))?" "+name:"";
            codeCategories[orderKey(term + suffix) + primarySecondary] = codeCategories[existingCategory];
            delete codeCategories[existingCategory];
          }
          placed=true;
          break;
        }
      }
      if(placed) break;
    }
    if(!placed) {
      // Don't add condition suffix if key already contains form of condition
      let suffix = (!clean(description).includes(clean(name))&&!clean(name).includes(clean(description))&&!description.split(" ").map(term=>{return stemmer.stem(term)}).includes(stemmer.stem(name)))?" "+name:"";
      codeCategories[orderKey(description + suffix) + primarySecondary] = [code];
    }
    return codeCategories;
  }

  static getCodeCategories(csvFile, name) {
    let codeCategories = {};
    let hasCategory = ["readcode", "snomedconceptid", "icdcode", "icd10code", "icd11code", "opcs4code"];
    let toCategorise = ["readv2code", "snomedcode", "snomedctconceptid", "icdcodeuncat", "conceptcd"];
    let codingSystems = ["read", "icd-9", "icd-10", "cpt", "icd10cm", "snomed", "icd9cm", "icd9diagnosis", "icd10diagnosis", "snomed-ct"];
    for(let row of csvFile) {
      if(row['case_incl'] && row['case_incl'] == 'N') continue;
      // Remove special characters from keys that prevent indexing
      for(const [key, value] of Object.entries(row)) {
        if(key!=key.replace(/[^a-zA-Z0-9]/g, "")) {
          row[key.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()] = row[key];
          delete row[key];
          continue;
        }
        if(key.toLowerCase()!=key) {
          row[key.toLowerCase()] = row[key];
          delete row[key];
        }
      }
      let keys = Object.keys(row);
      let value, hasCategoryKeys, toCategoriseKeys;
      function getFirstUsableValue(keys, row) {
        let value;
        for(let key of keys) {
          if (!row[key]||!row[key].length) continue;
          value = row[key];
          break;
        }
        if(!value) console.error("No usable value for "+JSON.stringify(row)+" "+name);
        return value;
      }
      let system;
      if((hasCategoryKeys = keys.filter(value=>hasCategory.includes(value))) && hasCategoryKeys.length) {
        let category = (row["category"]||row["calibercategory"]||name) + ((hasCategoryKeys[0].includes("read")||hasCategoryKeys[0].includes("snomed"))?" - primary":" - secondary");
        if(!codeCategories[category]) codeCategories[category] = [];
        value = getFirstUsableValue(hasCategoryKeys, row);
        if(value) { codeCategories[category].push(value) } else { return false };
      } else if((system=row["codingsystem"]||row["codetype"]) && codingSystems.includes(system.toLowerCase().replace(/ /g, '').trim())) {
        let description = row["description"].replace("[X]", "").replace("[D]", "");
        if(!row["code"]) return false;
        codeCategories = this.categorise(row["code"], description, codeCategories, name, (system=="read"||system=="snomed"));
      } else if(row["vocabulary"] && codingSystems.includes(row["vocabulary"].toLowerCase().trim())) {
        let conceptName = row["conceptname"];
        codeCategories = this.categorise(row["conceptcode"], conceptName, codeCategories, name);
      } else if((toCategoriseKeys = keys.filter(value => toCategorise.includes(value))) && toCategoriseKeys.length) {
        let description = row["conceptname"]||row["proceduredescr"]||row["description"].replace("[X]", "").replace("[D]", "");
        if(!description) continue;
        value = getFirstUsableValue(toCategoriseKeys, row);
        if(value) {codeCategories = this.categorise(value, description, codeCategories, name); } else { return false };
      } else if(row["prodcode"]) {
        let category = "Use of " + row["drugsubstance"];
        if(!codeCategories[category]) codeCategories[category] = [];
        if(!row["prodcode"]) return false;
        codeCategories[category].push(row["prodcode"]);
      } else if(row["code"]) {
        let category = name + " - UK Biobank";
        if (!codeCategories[category]) codeCategories[category] = [];
        if(!row["code"]) return false;
        codeCategories[category].push(row["code"]);
      } else {
        console.error("No handler for: "+JSON.stringify(row)+" "+name);
        //return false;
      }
    }
    
    if(Object.keys(codeCategories).length == 0 || Object.keys(codeCategories).indexOf("undefined - primary")>-1 || Object.keys(codeCategories).indexOf("undefined - secondary")>-1) {
      console.error("No category for " + name + ": " + JSON.stringify(codeCategories));
      return false;
    }

    return codeCategories;
  }

  static async importPhenotypeCSVs(phenotypeFiles) {
    let fullCSV;

    for(let phenotypeFile of phenotypeFiles) {

      const PATH = "test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_phenotypes/"+phenotypeFile;

      try {
        await fs.stat(PATH)
      } catch(error) {
        console.error(PATH+" does not exist.");
        return false;
      }

      try {
        var markdown = JSON.parse(m2js.parse([PATH], {width: 0, content: true}));
        var markdownContent = markdown[phenotypeFile.replace(".md", "")];
      } catch(error) {
        console.error(phenotypeFile+": "+error);
        return false;
      }

      if(!markdownContent.codelists) return true;

      if(!Array.isArray(markdownContent.codelists)) markdownContent.codelists = [markdownContent.codelists];

      for(let codelist of markdownContent.codelists) {
        let currentCSVSource;
        codelist = codelist.endsWith(".csv")?codelist:codelist+".csv"
        codelist = codelist.replace(".csv.csv", ".csv")
        try {
          currentCSVSource = await fs.readFile("test/"+config.get("importer.PHENOTYPE_FOLDER")+"/_data/codelists/"+codelist);
        } catch(error) {
          console.error("Could not read codelist for " + phenotypeFile + ": " + error);
          return false;
        }
        let currentCSV;
        try {
          currentCSV = await parse(currentCSVSource);
        } catch(error) {
          console.error(error)
        }
        fullCSV = fullCSV?fullCSV.concat(currentCSV):currentCSV;
      }

    }

    if(!fullCSV) return false;
    let codeCategories = this.getCodeCategories(fullCSV, markdownContent.name);
    return await this.importPhenotype(markdownContent.name, markdownContent.phenotype_id+" - "+markdownContent.title, codeCategories, "caliber");
    
  }

  static async groupPhenotypeFiles(path) {
    let phenotypeFiles = await fs.readdir(path);
    let groups={};
    for(let phenotypeFile of phenotypeFiles) {
      let markdown = JSON.parse(m2js.parse([path+phenotypeFile], {width: 0, content: true}))[phenotypeFile.replace(".md", "")];
      (groups[markdown.name+markdown.title]=groups[markdown.name+markdown.title]?groups[markdown.name+markdown.title]:[]).push(phenotypeFile);
    }
    return Object.values(groups);
  }

  static async importCodelist(path, file) {
    let csvFile, csv;
    try {
      csvFile = await fs.readFile(path + file);
    } catch(error) {
      console.error("Could not read codelist " + file + ": " + error);
      expect(false);
    }
    try {
      csv = await parse(csvFile);
    } catch(error) {
      console.error(error);
      expect(false);
    }
    let name = file.split("_")[0].split("-"); 
    if(name[name.length-1].match(/[0-9]*/)>0) name.pop();
    name[0] = name[0].charAt(0).toUpperCase() + name[0].substring(1);
    name = name.join(" ");
    let about = name;
    
    let codeCategories = this.getCodeCategories(csv, name);
    return await this.importPhenotype(name, about, codeCategories, "phekb");
  }

}

module.exports = Importer;
