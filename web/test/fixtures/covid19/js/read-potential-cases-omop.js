// martinchapman, 2020.

const got = require("got");
const fs = require('fs').promises;

const OHDSI_WEBAPI_ENDPOINT="http://localhost:8081/WebAPI";
const DB_SOURCE_NAME="OHDSI-CDMV5"

function patientToCodes(patients, patient, code) {

  if (!patients[patient]) patients[patient] = new Set();
  patients[patient].add(code);
  return patients;

}

(async()=>{

  let id=0, persons, years, patients={}, ages={}, lastEncounters={};

  try {
    persons = await got(OHDSI_WEBAPI_ENDPOINT + "/cdmresults/" + DB_SOURCE_NAME + "/person/").json();
    if (!persons) return;
  } catch(e) {
    console.error("Error counting patients in OMOP db.")
    return;
  }

  try {
    years = await got(OHDSI_WEBAPI_ENDPOINT + "/cdmresults/" + DB_SOURCE_NAME + "/observationPeriod/").json();
    if (!years) return;
  } catch(e) {
    console.error("Error getting months.")
    return;
  }

  let maxPersons = persons.summary.filter(summary=>summary.attributeName=="Number of persons")[0].attributeValue;
  let start = new Date(years.observedByMonth[0].monthYear.toString().substring(0,4)+"-"+years.observedByMonth[0].monthYear.toString().substring(4,6)+"-"+"01");
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
    let lastEncounterEnd = person.records.filter(record=>record.domain=="condition").sort((a,b)=>b.endDay-a.endDay)[0].endDay;
    let lastEncounter = new Date(start.getTime()+lastEncounterEnd*24*60*60*1000);
    lastEncounters[id]=lastEncounter.toISOString();
  }

  await fs.writeFile('covid-potential-cases.csv', "patient-id,dob,codes,last-encounter\n");
  for(let patient in patients) {
    try {
      const row = patient+","+ages[patient]+",\""+Array.from(patients[patient]).join(",")+"\","+lastEncounters[patient].substring(0, lastEncounters[patient].length-1)+"\n";
      await fs.appendFile('covid-potential-cases.csv', row);
    } catch(error) {
      console.log(error);
    }
  }

})();
