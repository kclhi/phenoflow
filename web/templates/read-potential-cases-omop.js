// martinchapman, 2020.

const got = require("got");
const fs = require('fs').promises;

const OHDSI_WEBAPI_ENDPOINT="http://172.19.0.1:8080/WebAPI";
const DB_SOURCE_NAME="OHDSI-CDMV5"

function patientToCodes(patients, patient, code) {

  if (!patients[patient]) patients[patient] = new Set();
  patients[patient].add(code);
  return patients;

}

(async()=>{

  let id=0, persons, patients={}, ages={};

  try {
    persons = await got(OHDSI_WEBAPI_ENDPOINT + "/cdmresults/" + DB_SOURCE_NAME + "/person/").json();
    if (!persons) return;
  } catch(e) {
    console.error("Error counting patients in OMOP db.")
    return;
  }

  let maxPersons = persons.summary.filter(summary=>summary.attributeName=="Number of persons")[0].attributeValue;
  while(id < maxPersons) {
    console.log("Finding patients..."+Math.floor(id/maxPersons*100)+"%");
    let person;
    try {
      person = await got(OHDSI_WEBAPI_ENDPOINT + "/" + DB_SOURCE_NAME + "/person/" + ++id).json();
    } catch(e) {
      continue;
    }
    for(let code of person.records.filter(record=>record.domain=="condition").map(record=>record.conceptId)) patients = patientToCodes(patients, id, code);
    if(person.yearOfBirth) ages[id]=person.yearOfBirth+"-01-01";
    else ages[id]="0000-00-00";
  }

  await fs.writeFile('[PHENOTYPE]-potential-cases.csv', "patient-id,dob,codes\n");
  for(let patient in patients) {
    try {
      const row = patient+","+ages[patient]+",\""+Array.from(patients[patient]).join(",")+"\"\n";
      await fs.appendFile('[PHENOTYPE]-potential-cases.csv', row);
    } catch(error) {
      console.log(error);
    }
  }

})();
