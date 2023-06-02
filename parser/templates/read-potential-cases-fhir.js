// martinchapman, 2021.

const got = require("got");
const fs = require("fs").promises;

const FHIR_ENDPOINT="http://localhost:8081";
const FHIR_API_PATH="/hapi/fhir";

function patientToCodes(patients, patient, code) {

  if (!patients[patient]) patients[patient] = new Set();
  patients[patient].add(code);
  return patients;

}

(async () => {

  let patients={}, dobs={}, conditions, lastEncounters={};
  try {
    conditions = await got.get(FHIR_ENDPOINT+FHIR_API_PATH+"/Condition", {responseType:"json"});
    conditions = conditions.body;
  } catch(error) {
    console.error("Unable to find conditions: "+error);
  }
  for(let condition of conditions.entry) {
    condition = condition.resource;
    let patient = await got.get(FHIR_ENDPOINT+FHIR_API_PATH+"/"+condition.subject.reference, {responseType:"json"});
    let patientId = patient.body.id;
    dobs[patientId] = patient.body.birthDate?patient.body.birthDate:"0000-00-00";
    let associatedEncounter = await got.get(FHIR_ENDPOINT+FHIR_API_PATH+"/"+condition.context.reference, {responseType:"json"});
    patients = patientToCodes(patients, patientId, "("+condition.code.coding[0].code+","+new Date(associatedEncounter.body.period.end).toISOString()+")");
    if(!lastEncounters[patientId]||new Date(associatedEncounter.body.period.end)>lastEncounters[patientId]) lastEncounters[patientId] = new Date(associatedEncounter.body.period.end);
  };

  await fs.writeFile("[PHENOTYPE]-potential-cases.csv", "patient-id,dob,codes,last-encounter\n");
  for(let patient in patients) {
    try {
      lastEncounters[patient] = lastEncounters[patient].toISOString();
      const row = patient+","+dobs[patient]+",\""+Array.from(patients[patient]).join(",")+"\","+lastEncounters[patient].slice(0,-1)+"\n";
      await fs.appendFile("[PHENOTYPE]-potential-cases.csv", row);
    } catch(error) {
      console.log(error);
    }
  }

})();
