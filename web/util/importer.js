const logger = require('../config/winston');
const parse = require('neat-csv');
const fs = require('fs').promises;
const nlp = require('compromise');
const stringSimilarity = require("string-similarity");
const natural = require("natural");
const stemmer = natural.PorterStemmer;

const WorkflowUtils = require("./workflow");

class Importer {

  static primaryCodeKeys() {
    return ["readcode", "snomedconceptid", "readv2code", "snomedcode", "snomedctconceptid", "conceptcode", "conceptcd", "snomedctcode", "conceptid"];
  }

  static secondaryCodeKeys() {
    return ["icdcode", "icd10code", "icd11code", "opcs4code", "icdcodeuncat"];
  }

  static splitExpression() {
    return /\s?\/\s?|\s?\+\s?|\s?\_\s?|\s/;
  }

  static termAndName(term, name) {
    return name.split(" ").map(word=>this.clean(word)).filter(word=>word.includes(term)).length
        || name.split(" ").map(word=>this.clean(stemmer.stem(word))).filter(word=>word.includes(stemmer.stem(term))).length 
        || name.split(" ").filter(word=>term.includes(this.clean(word)||stemmer.stem(term).includes(this.clean(stemmer.stem(word))))).length;
  }

  static fullClean(input) {
    if(!input) return input;
    return input.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  static clean(input, spaces=false) {
    input = input.replace(/\//g, "").replace(/(\s)?\(.*\)/g, "").replace(/\,/g, "").replace(/&amp;/g, "and");
    if(!spaces) input = input.replace(/ /g, "-");
    return input;
  }

  static getValue(row) {
    if(row["code"]) return row["code"];
    let otherKeyCodes;
    const codeKeys = this.primaryCodeKeys().concat(this.secondaryCodeKeys());
    if((otherKeyCodes=Object.keys(row).filter(key=>codeKeys.includes(key.toLowerCase())))&&otherKeyCodes) for(let keyCode of otherKeyCodes) if(row[keyCode]) return row[keyCode];
    throw "No usable value for "+JSON.stringify(row)+" "+otherKeyCodes;
  }

  static getDescription(row) {
    const descriptions = ["description", "conceptname", "proceduredescr", "icd10term", "icd11term", "snomedterm", "icd10codedescr", "icdterm", "readterm", "readcodedescr", "term", "snomedctterm"];
    let description = row[Object.keys(row).filter(key=>descriptions.includes(Importer.clean(key)))[0]];
    let splitDescription = [];
    if(description) {
      description = description.replace("[X]", "").replace("[D]", "");
      splitDescription = description.split(Importer.splitExpression());
    }
    // 'Shortness of breath' becomes 'breath shortness', for example, so as not to lose meaning when removing ignored words.
    if(splitDescription.length==3&&splitDescription[1]=="of") splitDescription=[splitDescription[2],splitDescription[0]];
    if(description&&splitDescription.length>1) description=splitDescription.filter(word=>!WorkflowUtils.ignoreInStepName(Importer.clean(word))).join(" ");    
    return description;
  }

  static getCategories(csvFiles, name, valueFunction=this.getValue, descriptionFunction=this.getDescription) {
    let categories = {};
    const primaryCodingSystems = ["read", "snomed", "snomedct"];
    const secondaryCodingSystems = ["icd9", "icd10", "cpt", "icd10cm", "icd9cm", "icd9diagnosis", "icd10diagnosis"];
    const codingSystems = primaryCodingSystems.concat(secondaryCodingSystems);
    function singular(term) { return nlp(term).nouns().toSingular().text() || term; }
    function getKeyTerm(phrase, name) {
      if(phrase.split(Importer.splitExpression()).length==1) return phrase;
      if(phrase.split(Importer.splitExpression()).filter(term=>!Importer.termAndName(term,name)).length>0) return name;
      let nouns = nlp(phrase).nouns().text().split(Importer.splitExpression()).filter(word=>!WorkflowUtils.ignoreInStepName(Importer.clean(word)));
      let adjectives = nlp(phrase).adjectives().text().split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(Importer.clean(word)));
      return nouns.length?Importer.clean(nouns[0]):Importer.clean(adjectives[0]);
    }
    function orderKey(key) {
      let nameReplacement;
      // For definitions with multiple words in their name, use the last word when ordering
      if(key!=name&&key.includes(name)&&name.split(" ").length>1) {
        nameReplacement = name.split(" ").filter(word=>!WorkflowUtils.ignoreInStepName(Importer.clean(word)));
        nameReplacement = nameReplacement[nameReplacement.length-1];
        key = key.replace(name, nameReplacement);
      }
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
      if(nameReplacement) key = key.replace(nameReplacement, name);
      key=key.charAt(0).toUpperCase() + key.slice(1);
      return key;
    }
    function findAndCapitaliseName(text) {
      let newText="";
      for(let word of text.split(" ")) {
        if(name.toLowerCase().includes(word.toLowerCase())) newText+=word.charAt(0).toUpperCase() + word.substring(1)+" ";
        else newText+=word+" ";
      }
      return newText.substring(0,newText.length-1);
    }
    for(let csvFile of csvFiles) {
      let codingSystem, termCount={};
      csvFile=csvFile.filter(row=>(row["case_incl"]&&row["case_incl"]!="N")||!row["case_incl"]);
      // Initial cleaning and counting terms
      for(let row of csvFile) {
        // Remove special characters from keys that prevent indexing
        for(const [key, value] of Object.entries(row)) {
          if(key!=this.fullClean(key)) {
            row[this.fullClean(key)] = row[key];
            delete row[key];
            continue;
          }
          if(key!=key.toLowerCase()) {
            row[key.toLowerCase()] = row[key];
            delete row[key];
          }
        }
        let description=descriptionFunction(row);
        if(description) {
          for(let term of description.split(this.splitExpression())) {
            term = singular(this.fullClean(term));
            // Term shouldn't be in phenotype name
            if(this.termAndName(term, name)||term.length<=4) continue;
            Object.keys(termCount).includes(term)?termCount[term]=termCount[term]+=1:termCount[term]=1;
          }
        }
      }
      var primarySecondary = ((codingSystem=csvFile[0]["codingsystem"]||csvFile[0]["codetype"]||csvFile[0]["vocabulary"])&&primaryCodingSystems.includes(this.fullClean(codingSystem)))||this.primaryCodeKeys().filter(primaryCodeKey=>Object.keys(csvFile[0]).map(key=>this.fullClean(key)).includes(this.fullClean(primaryCodeKey))).length?"primary":"secondary";
      const NOT_DIFFERENTIATING_CUTOFF=0.15;
      let termCountArray = Object.keys(termCount).map(key=>[key, termCount[key]]).filter(term=>term[1]>1);
      termCountArray.sort(function(first, second) { return second[1]-first[1]; });
      let numberOfTerms = termCountArray.length?termCountArray.map(term=>term[1]).reduce((a,b)=>a+b):0;
      let notDifferentiatingSubset = termCountArray.filter(term=>term[1]/parseFloat(numberOfTerms)>=NOT_DIFFERENTIATING_CUTOFF).map(term=>term[0]);
      // Exclude those terms too that are shorthand for those in the excluded subet
      notDifferentiatingSubset = notDifferentiatingSubset.concat(termCountArray.filter(term=>notDifferentiatingSubset.filter(subsetTerm=>subsetTerm!=term[0]&&subsetTerm.includes(term[0])).length));

      for(let row of csvFile) {
        let category, description=descriptionFunction(row);
        if(description) {
          let code=valueFunction(row);
          // Remaining work to categorise descriptions
          if(termCountArray.length) {
            let matched=false;
            for(let term of termCountArray.filter(term=>!notDifferentiatingSubset.includes(term)).map(term=>term[0]).reverse()) {
              if(description.split(" ").filter(word=>stringSimilarity.compareTwoStrings(singular(this.fullClean(word)), term) >= 0.8 
              || term.includes(singular(this.fullClean(word))) 
              || singular(this.fullClean(word)).includes(term)).length) {
                categories[term+"--"+primarySecondary]?categories[term+"--"+primarySecondary].push(code):categories[term+"--"+primarySecondary]=[code];
                matched=true;
                break;
              }
            }
            // If no common term, pick most representative term from description
            if(!matched) {
              let keyTerm = getKeyTerm(description, name);
              categories[keyTerm+"--"+primarySecondary]?categories[keyTerm+"--"+primarySecondary].push(code):categories[keyTerm+"--"+primarySecondary]=[code];
            }
          } else if(csvFile.length==1) {
            // If there's only one code, use its description
            category=findAndCapitaliseName(description)+"--"+primarySecondary;
            categories[category]?categories[category].push(code):categories[category]=[code];
          } else {
            // Otherwise, just use the name of the definition itself
            category=name+"--"+primarySecondary;
            categories[category]?categories[category].push(code):categories[category]=[code];
          }
        } else if(category=row["category"]||row["calibercategory"]) {
          let code=valueFunction(row);
          category+="--"+primarySecondary;
          categories[category]?categories[category].push(code):categories[category]=[code];
        } else if(row["prodcode"]) {
          category="Use of "+row["drugsubstance"]+"--"+primarySecondary;
          categories[category]?categories[category].push(row["prodcode"]):categories[category]=[row["prodcode"]];
        } else if(row["code"]) {
          category=name+" - UK Biobank"+"--"+primarySecondary;
          categories[category]?categories[category].push(row["code"]):categories[category]=[row["code"]];
        } else {
          logger.warn("No handler for: "+JSON.stringify(row)+" "+name);
          //return false;
        }
      }
    }

    let formattedCategories = {};
    for(const [term, codes] of Object.entries(categories)) {
      let termAndPrimarySecondary = term.split("--");
      let suffix = (!this.fullClean(termAndPrimarySecondary[0]).includes(this.fullClean(name))&&!this.fullClean(name).includes(this.fullClean(termAndPrimarySecondary[0])))?" "+name:"";
      termAndPrimarySecondary[0]==name?formattedCategories[termAndPrimarySecondary[0]+suffix+" - "+termAndPrimarySecondary[1]] = categories[term]:formattedCategories[orderKey(termAndPrimarySecondary[0]+suffix)+" - "+termAndPrimarySecondary[1]] = categories[term];
    }

    if(Object.keys(categories).length == 0 || Object.keys(categories).indexOf("undefined - primary")>-1 || Object.keys(categories).indexOf("undefined - secondary")>-1) {
      logger.error("No category for " + name + ": " + JSON.stringify(categories));
      return false;
    }

    return formattedCategories;
  }

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
    return name.join(" ").replace(".csv","");
  }

}

module.exports = Importer;
