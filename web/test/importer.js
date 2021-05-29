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
const WorkflowUtils = require("../util/workflow");

class Importer {

  static async importPhenotype(name, about, codeCategories, userName) {
    const server = proxyquire('../app', {'./routes/importer':proxyquire('../routes/importer', {'express-jwt':(...args)=>{return (req, res, next)=>{return next();}}})});
    let res = await chai.request(server).post("/phenoflow/importer").send({name:name, about:about, codeCategories:codeCategories, userName:userName});
    res.should.have.status(200);
    res.body.should.be.a("object");
    return true;
  }

  static clean(input) {
    if(!input) return input;
    return input.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  static getCodeCategories(csvFiles, name) {
    let codeCategories = {};
    const primaryCodeKeys = ["readcode", "snomedconceptid", "readv2code", "snomedcode", "snomedctconceptid", "conceptcode", "conceptcd"];
    const secondaryCodeKeys = ["icdcode", "icd10code", "icd11code", "opcs4code", "icdcodeuncat"];
    const codeKeys = primaryCodeKeys.concat(secondaryCodeKeys);
    const primaryCodingSystems = ["read", "snomed", "snomedct"];
    const secondaryCodingSystems = ["icd9", "icd10", "cpt", "icd10cm", "icd9cm", "icd9diagnosis", "icd10diagnosis"];
    const codingSystems = primaryCodingSystems.concat(secondaryCodingSystems);
    function singular(term) { return nlp(term).nouns().toSingular().text() || term; }
    function getKeyTerm(phrase, name) {
      if(phrase.split(" ").filter(word=>name.toLowerCase().includes(word.toLowerCase()))) return name;
      let nouns = nlp(phrase).nouns().text().split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(Importer.clean(word)));
      let adjectives = nlp(phrase).adjectives().text().split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(Importer.clean(word)));
      return nouns.length?Importer.clean(nouns[0]):Importer.clean(adjectives[0]);
    }
    function getValue(row) {
      if(row["code"]) return row["code"];
      let otherKeyCodes;
      if((otherKeyCodes=Object.keys(row).filter(key=>codeKeys.includes(key.toLowerCase())))&&otherKeyCodes) return row[otherKeyCodes[0]];
      console.error("No usable value for "+JSON.stringify(row)+" "+name);
      return 0;
    }
    function getDescription(row) {
      const descriptions = ["description", "conceptname", "proceduredescr", "icd10term", "icd11term", "snomedterm", "icd10codedescr", "icdterm", "readterm", "readcodedescr"];
      let description = row[Object.keys(row).filter(key=>descriptions.includes(Importer.clean(key)))[0]];
      if(description) description = description.replace("[X]", "").replace("[D]", "")
      if(description&&description.includes(" ")) description=description.split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(Importer.clean(word))).join(" ");
      return description;
    }
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
    for(let csvFile of csvFiles) {
      let codingSystem, termCount={};
      var primarySecondary = ((codingSystem=csvFile[0]["codingsystem"]||csvFile[0]["codetype"]||csvFile[0]["vocabulary"])&&primaryCodingSystems.includes(this.clean(codingSystem)))||primaryCodeKeys.filter(primaryCodeKey=>Object.keys(csvFile[0]).map(key=>this.clean(key)).includes(this.clean(primaryCodeKey))).length?"primary":"secondary";
      csvFile=csvFile.filter(row=>(row["case_incl"]&&row["case_incl"]!="N")||!row["case_incl"]);
      // Initial cleaning and counting terms
      for(let row of csvFile) {
        // Remove special characters from keys that prevent indexing
        for(const [key, value] of Object.entries(row)) {
          if(key!=this.clean(key)) {
            row[this.clean(key)] = row[key];
            delete row[key];
            continue;
          }
          if(key!=key.toLowerCase()) {
            row[key.toLowerCase()] = row[key];
            delete row[key];
          }
        }
        let description=getDescription(row);
        if(description) {
          for(let term of description.split(" ")) {
            term = singular(this.clean(term));
            if(name.split(" ").map(word=>Importer.clean(word)).filter(word=>word.includes(term)).length
            || name.split(" ").map(word=>Importer.clean(stemmer.stem(word))).filter(word=>word.includes(stemmer.stem(term))).length 
            || name.split(" ").filter(word=>term.includes(Importer.clean(word)||stemmer.stem(term).includes(Importer.clean(stemmer.stem(word))))).length 
            || term.length<=4) continue;
            Object.keys(termCount).includes(term)?termCount[term]=termCount[term]+=1:termCount[term]=1;
          }
        }
      }

      const NOT_DIFFERENTIATING_CUTOFF=0.15;
      let termCountArray = Object.keys(termCount).map(key=>[key, termCount[key]]).filter(term=>term[1]>1);
      termCountArray.sort(function(first, second) { return second[1]-first[1]; });
      let numberOfTerms = termCountArray.length?termCountArray.map(term=>term[1]).reduce((a,b)=>a+b):0;
      let notDifferentiatingSubset = termCountArray.filter(term=>term[1]/parseFloat(numberOfTerms)>=NOT_DIFFERENTIATING_CUTOFF).map(term=>term[0]);
      // Exclude those terms too that are shorthand for those in the excluded subet
      notDifferentiatingSubset = notDifferentiatingSubset.concat(termCountArray.filter(term=>notDifferentiatingSubset.filter(subsetTerm=>subsetTerm!=term[0]&&subsetTerm.includes(term[0])).length));

      for(let row of csvFile) {
        let category, code=getValue(row), description=getDescription(row);
        if(description) {
          // Remaining work to categorise descriptions
          if(termCountArray.length) {
            let matched=false;
            for(let term of termCountArray.filter(term=>!notDifferentiatingSubset.includes(term)).map(term=>term[0]).reverse()) {
              if(description.split(" ").filter(word=>stringSimilarity.compareTwoStrings(singular(this.clean(word)), term) >= 0.8 
              || term.includes(singular(this.clean(word))) 
              || singular(this.clean(word)).includes(term)).length) {
                codeCategories[term+"--"+primarySecondary]?codeCategories[term+"--"+primarySecondary].push(code):codeCategories[term+"--"+primarySecondary]=[code];
                matched=true;
                break;
              }
            }
            // If not common term, pick most representative term from description
            if(!matched) {
              let keyTerm = getKeyTerm(description, name);
              codeCategories[keyTerm+"--"+primarySecondary]?codeCategories[keyTerm+"--"+primarySecondary].push(code):codeCategories[keyTerm+"--"+primarySecondary]=[code];
            }
          } else {
            category=name+"--"+primarySecondary;
            codeCategories[category]?codeCategories[category].push(code):codeCategories[category]=[code];
          }
        } else if(category=row["category"]||row["calibercategory"]) {
          category+="--"+primarySecondary;
          codeCategories[category]?codeCategories[category].push(code):codeCategories[category]=[code];
        } else if(row["prodcode"]) {
          category="Use of "+row["drugsubstance"]+"--"+primarySecondary;
          codeCategories[category]?codeCategories[category].push(row["prodcode"]):codeCategories[category]=[row["prodcode"]];
        } else if(row["code"]) {
          category=name+" - UK Biobank"+"--"+primarySecondary;
          codeCategories[category]?codeCategories[category].push(row["code"]):codeCategories[category]=[row["code"]];
        } else {
          console.error("No handler for: "+JSON.stringify(row)+" "+name);
          //return false;
        }
      }
    }
  
    let formattedCodeCategories = {};
    for(const [term, codes] of Object.entries(codeCategories)) {
      let termAndPrimarySecondary = term.split("--");
      let suffix = (!this.clean(termAndPrimarySecondary[0]).includes(this.clean(name))&&!this.clean(name).includes(this.clean(termAndPrimarySecondary[0])))?" "+name:"";
      termAndPrimarySecondary[0]==name?formattedCodeCategories[termAndPrimarySecondary[0]+suffix+" - "+termAndPrimarySecondary[1]] = codeCategories[term]:formattedCodeCategories[orderKey(termAndPrimarySecondary[0]+suffix)+" - "+termAndPrimarySecondary[1]] = codeCategories[term];
    }

    if(Object.keys(codeCategories).length == 0 || Object.keys(codeCategories).indexOf("undefined - primary")>-1 || Object.keys(codeCategories).indexOf("undefined - secondary")>-1) {
      console.error("No category for " + name + ": " + JSON.stringify(codeCategories));
      return false;
    }

    return formattedCodeCategories;
  }

  static async importPhenotypeCSVs(phenotypeFiles) {
    let allCSVs=[];

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
        allCSVs.push(currentCSV);
      }

    }
    if(allCSVs.length==0) return false;
    let codeCategories = this.getCodeCategories(allCSVs, markdownContent.name);
    if(codeCategories) return await this.importPhenotype(markdownContent.name, markdownContent.phenotype_id+" - "+markdownContent.title, codeCategories, "caliber");
    else return false;
    
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
    
    let codeCategories = this.getCodeCategories([csv], name);
    if (codeCategories) return await this.importPhenotype(name, about, codeCategories, "phekb");
    else return false;
  }

}

module.exports = Importer;
