const logger = require('../config/winston');
const nlp = require('compromise');
const stringSimilarity = require("string-similarity");
const natural = require("natural");
const stemmer = natural.PorterStemmer;

class Parser {

  static primaryCodeKeys() {
    return ["readcode", "snomedconceptid", "readv2code", "snomedcode", "snomedctconceptid", "conceptcode", "conceptcd", "snomedctcode", "conceptid", "readorsnomedterm"];
  }

  static secondaryCodeKeys() {
    return ["icdcode", "icd10code", "icd11code", "opcs4code", "icdcodeuncat", "keyword"];
  }

  static splitExpression() {
    return /\s?\/\s?|\s?\+\s?|\s?\_\s?|\s/;
  }

  static termAndName(term, name) {
    return name.split(" ").map(word=>this.clean(word)).filter(word=>word.includes(term)).length
        || name.split(" ").map(word=>this.clean(stemmer.stem(word))).filter(word=>word.includes(stemmer.stem(term))).length 
        || name.split(" ").filter(word=>term.includes(this.clean(word)||stemmer.stem(term).includes(this.clean(stemmer.stem(word))))).length;
  }

  static ignoreInStepName(word) {
    let conditionSynonyms = ["syndrome", "infection", "infections", "disease", "diseases", "disorder", "disorders", "malignancy", "status", "diagnosis", "dysfunction", "accident", "difficulty", "symptom", "symptoms", "cause", "caused"];
    let ignoreWords = ["not", "use", "type", "using", "anything", "enjoying"];
    let nlpd = nlp(word);
    return word.length <= 2
      || conditionSynonyms.concat(ignoreWords).includes(word.toLowerCase()) 
      || nlpd.conjunctions().length>0
      || nlpd.prepositions().length>0 
      || nlpd.adverbs().length>0;
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

  static lightClean(input) {
    input = input.replace("(", "").replace(")", "");
    return input;
  }

  static cleanCSVHeaders(row) {
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
    return row;
  }

  static getValue(row) {
    if(row["code"]) return row["code"];
    let otherKeyCodes;
    const codeKeys = Parser.primaryCodeKeys().concat(Parser.secondaryCodeKeys());
    if((otherKeyCodes=Object.keys(row).filter(key=>codeKeys.includes(key.toLowerCase())))&&otherKeyCodes) for(let keyCode of otherKeyCodes) if(row[keyCode]) return row[keyCode];
    throw "No usable value for "+JSON.stringify(row)+" "+otherKeyCodes;
  }

  static getDescription(row) {
    const descriptions = ["description", "conceptname", "proceduredescr", "icd10term", "icd11term", "snomedterm", "icd10codedescr", "icdterm", "readterm", "readcodedescr", "term", "snomedctterm", "name"];
    let description = row[descriptions.filter(description=>Object.keys(row).map(key=>Parser.clean(key)).includes(description))[0]];
    let splitDescription = [];
    if(description) {
      description = description.replace("[X]", "").replace("[D]", "");
      splitDescription = description.split(Parser.splitExpression());
    }
    // 'Shortness of breath' becomes 'breath shortness', for example, so as not to lose meaning when removing ignored words.
    if(splitDescription.length==3&&splitDescription[1]=="of") splitDescription=[splitDescription[2],splitDescription[0]];
    if(description&&splitDescription.length>1) description=splitDescription.filter(word=>!Parser.ignoreInStepName(Parser.clean(word))).join(" ");    
    return description;
  }

  static singular(term) { return nlp(term).nouns().toSingular().text() || term; }

  static getTermCount(csvFile, name, descriptionFunction) {
    let termCount = {};
    // Initial cleaning and counting terms
    for(let row of csvFile) {
      row = Parser.cleanCSVHeaders(row);
      let description=descriptionFunction(row);
      if(description) {
        for(let term of description.split(Parser.splitExpression())) {
          term = Parser.singular(Parser.fullClean(term));
          // Term shouldn't be in phenotype name
          if(Parser.termAndName(term, name)||term.length<=4) continue;
          Object.keys(termCount).includes(term)?termCount[term]=termCount[term]+=1:termCount[term]=1;
        }
      }
    }
    termCount = Object.keys(termCount).map(key=>[key, termCount[key]]).filter(term=>term[1]>1);
    termCount.sort(function(first, second) { return second[1]-first[1]; });
    return termCount;
  }

  static getNotDifferentiatingSubset(termCount) {
    const NOT_DIFFERENTIATING_CUTOFF=0.15;
    let numberOfTerms = termCount.length?termCount.map(term=>term[1]).reduce((a,b)=>a+b):0;
    let notDifferentiatingSubset = termCount.filter(term=>term[1]/parseFloat(numberOfTerms)>=NOT_DIFFERENTIATING_CUTOFF).map(term=>term[0]);
    // Exclude those terms too that are shorthand for those in the excluded subet
    notDifferentiatingSubset = notDifferentiatingSubset.concat(termCount.filter(term=>notDifferentiatingSubset.filter(subsetTerm=>subsetTerm!=term[0]&&subsetTerm.includes(term[0])).length));
    return notDifferentiatingSubset;
  }

  static getFileCategory(csvFile, name, descriptionFunction=this.getDescription) {
    let termCount = Parser.getTermCount(csvFile, name, descriptionFunction);
    let terms = termCount.filter(term=>!Parser.getNotDifferentiatingSubset(termCount).includes(term));
    if(terms.length&&terms[0][1]>=csvFile.length) return terms[0][0]; else return ""; 
  }

  static getCategories(csvFiles, name, valueFunction=this.getValue, descriptionFunction=this.getDescription) {

    let categories = {};
    const primaryCodingSystems = ["read", "snomed", "snomedct"];
    const secondaryCodingSystems = ["icd9", "icd10", "cpt", "icd10cm", "icd9cm", "icd9diagnosis", "icd10diagnosis"];
    name = this.lightClean(name);

    function getKeyTerm(phrase, name) {
      if(phrase.split(Parser.splitExpression()).length==1) return phrase;
      if(phrase.split(Parser.splitExpression()).filter(term=>!Parser.termAndName(term, name.toLowerCase())).length) return name;
      let nouns = nlp(phrase).nouns().text().split(Parser.splitExpression()).filter(word=>!Parser.ignoreInStepName(Parser.clean(word)));
      let adjectives = nlp(phrase).adjectives().text().split(" ").filter(word=>!Parser.ignoreInStepName(Parser.clean(word)));
      return nouns.length?Parser.clean(nouns[0]):Parser.clean(adjectives[0]);
    }

    function orderKey(key) {
      let nameReplacement;
      // For definitions with multiple words in their name, use the last word when ordering
      if(key!=name&&key.includes(name)&&name.split(" ").length>1) {
        nameReplacement = name.split(" ").filter(word=>!Parser.ignoreInStepName(Parser.clean(word)));
        nameReplacement = nameReplacement[nameReplacement.length-1];
        key = key.replace(name, nameReplacement);
      }
      // Don't attempt reorder on more than two words
      let keyTerms = key.split(" ");
      if(keyTerms.length==2) {
        let nlpKey = nlp(key);
        let adjectives = nlpKey.adjectives()?nlpKey.adjectives().out("text").split(" "):null;
        let nouns = nlpKey.nouns()?nlpKey.nouns().out("text").split(" "):null;
        // Adjectives first; both nouns, condition first
        if(adjectives&&adjectives.length==1&&adjectives[0]!=keyTerms[0]
          ||nouns&&nouns.length==2&&name!=keyTerms[0]) {
            key=keyTerms[1].toLowerCase();
            key+=" "+keyTerms[0].toLowerCase();
        }
      }
      if(nameReplacement) key=key.toLowerCase().replace(nameReplacement.toLowerCase(), name);
      return key.charAt(0).toUpperCase()+key.slice(1);
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
      let codingSystem;
      let filename = csvFile.filename.split(".")[0];
      csvFile=csvFile.content.filter(row=>(row["case_incl"]&&row["case_incl"]!="N")||!row["case_incl"]);
      
      function isCodingSystemGroup(groupSystems, groupKeys) {
        return ((codingSystem=csvFile[0]["codingsystem"]||csvFile[0]["codetype"]||csvFile[0]["vocabulary"])&&groupSystems.includes(Parser.fullClean(codingSystem)))||groupKeys().filter(codeKey=>Object.keys(csvFile[0]).map(key=>Parser.fullClean(key)).includes(Parser.fullClean(codeKey))).length;
      }
      
      var codingSystemGroup = isCodingSystemGroup(primaryCodingSystems, this.primaryCodeKeys)?"--primary":(isCodingSystemGroup(secondaryCodingSystems, this.secondaryCodeKeys)?"--secondary":"");
      let termCount = this.getTermCount(csvFile, name, descriptionFunction);

      for(let row of csvFile) {
        let category, description=descriptionFunction(row);
        const OTHER_CODING_SYSTEMS = ["UK Biobank", "TADDS", "HES"];
        if(description&&(isCodingSystemGroup(primaryCodingSystems, this.primaryCodeKeys)||isCodingSystemGroup(secondaryCodingSystems, this.secondaryCodeKeys)||(codingSystemGroup="--"+OTHER_CODING_SYSTEMS.filter((system)=>Parser.fullClean(system)==Parser.fullClean(filename.split("_")[filename.split("_").length-1]))[0]))) {
          let code=valueFunction(row);
          // Remaining work to categorise descriptions
          if(termCount.length) {
            let matched=false;
            for(let term of termCount.filter(term=>!this.getNotDifferentiatingSubset(termCount).includes(term)).map(term=>term[0]).reverse()) {
              if(description.split(" ").filter(word=>stringSimilarity.compareTwoStrings(Parser.singular(this.fullClean(word)), term) >= 0.8 
              || term.includes(Parser.singular(this.fullClean(word))) 
              || Parser.singular(this.fullClean(word)).includes(term)).length) {
                categories[term+codingSystemGroup]?categories[term+codingSystemGroup].push(code):categories[term+codingSystemGroup]=[code];
                matched=true;
                break;
              }
            }
            // If no common term, pick most representative term from description
            if(!matched) {
              let keyTerm = getKeyTerm(description, name);
              categories[keyTerm+codingSystemGroup]?categories[keyTerm+codingSystemGroup].push(code):categories[keyTerm+codingSystemGroup]=[code];
            }
          } else if(csvFile.length==1) {
            // If there's only one code, use its description
            category=findAndCapitaliseName(description)+codingSystemGroup;
            categories[category]?categories[category].push(code):categories[category]=[code];
          } else {
            // Otherwise, just use the name of the definition itself
            category=name+codingSystemGroup;
            categories[category]?categories[category].push(code):categories[category]=[code];
          }
        } else if(category=row["category"]||row["calibercategory"]) {
          let code=valueFunction(row);
          category+=codingSystemGroup;
          categories[category]?categories[category].push(code):categories[category]=[code];
        } else if(row["prodcode"]) {
          category="Use of "+row["drugsubstance"]+codingSystemGroup;
          categories[category]?categories[category].push(row["prodcode"]):categories[category]=[row["prodcode"]];
        } else {
          logger.warn("No handler for: "+JSON.stringify(row)+" "+name);
          //return false;
        }
      }
    }

    let formattedCategories = {};
    for(const [term, codes] of Object.entries(categories)) {
      let termAndCodeGroup = term.split("--");
      let suffix = (!this.fullClean(termAndCodeGroup[0]).includes(this.fullClean(name))&&!this.fullClean(name).includes(this.fullClean(termAndCodeGroup[0])))?" "+name:"";
      termAndCodeGroup[0]==name?formattedCategories[termAndCodeGroup[0]+suffix+" - "+termAndCodeGroup[1]] = categories[term]:formattedCategories[orderKey(termAndCodeGroup[0]+suffix)+" - "+termAndCodeGroup[1]] = categories[term];
    }

    if(Object.keys(categories).length == 0 || Object.keys(categories).indexOf("undefined - primary")>-1 || Object.keys(categories).indexOf("undefined - secondary")>-1) {
      logger.error("No category for " + name + ": " + JSON.stringify(categories) + JSON.stringify(csvFiles));
      return false;
    }

    return formattedCategories;
  }

  static templateReplace(source, substitutions) {
    for(let substitution in substitutions) {
      if(!source.includes("["+substitution+"]")) console.warn("Attempted substitition of non-existent variable in template: " + substitution);
      source = source.replace(new RegExp("\\\["+substitution+"\\\]", "g"), substitutions[substitution]);
    }
    return source;
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

  static conditionFromFilename(filename) {
    return filename.substring(0, filename.lastIndexOf("_")).split("-").join(" ");
  }

  static summariseSteplist(steplist) {
    let usedCodelists=[], includes=[], without=[];
    steplist = steplist.content.reverse();
    for(let step of steplist) {
      let splitParams = step.param.split(":");
      if(step.logicType=="codelistsTemporal") {
        if(usedCodelists.includes(splitParams[0])||usedCodelists.includes(splitParams[1])) continue;
        let phrase = "Diagnosis of "+this.conditionFromFilename(splitParams[1])+" "+splitParams[2]+" days to "+splitParams[3]+" days after "+this.conditionFromFilename(splitParams[0]);
        includes.push(phrase);
        usedCodelists = usedCodelists.concat([splitParams[0], splitParams[1]]);
      } else if(step.logicType=="codelist") {
        if(usedCodelists.includes(splitParams[0])) continue;
        let phrase = this.conditionFromFilename(splitParams[0]);
        includes.push(phrase);
      } else if(step.logicType=="codelistExclude") {
        if(usedCodelists.includes(splitParams[0])) continue;
        let phrase = this.conditionFromFilename(splitParams[0]);
        without.push(phrase);
      }
    }
    steplist = steplist.reverse();
    return includes[0]+(includes.length>1?" following "+includes.slice(1).join(" and "):"")+(without.length?", without a record of "+without.join(" and "):"");
  }

}

module.exports = Parser;
