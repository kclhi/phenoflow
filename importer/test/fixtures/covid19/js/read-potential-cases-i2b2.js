// martinchapman, 2020.

const got = require("got");
const parser = require('fast-xml-parser');
const fs = require('fs').promises;

const I2B2_ENDPOINT="http://localhost:8081";
const USERNAME="demo";
const PASSWORD="demouser";

function patientToCodes(patients, patient, code) {

  if (!patients[patient]) patients[patient] = new Set();
  patients[patient].add(code);
  return patients;

}

(async () => {

  const SECURITY='<security> <domain>i2b2demo</domain> <username>' + USERNAME + '</username> <password>' + PASSWORD + '</password> </security>';
  const REQUEST_HEADER='<?xml version="1.0" encoding="UTF-8" standalone="yes"?> <ns6:request xmlns:ns4="http://www.i2b2.org/xsd/cell/crc/psm/1.1/" xmlns:ns7="http://www.i2b2.org/xsd/cell/ont/1.1/" xmlns:ns3="http://www.i2b2.org/xsd/cell/crc/pdo/1.1/" xmlns:ns5="http://www.i2b2.org/xsd/hive/plugin/" xmlns:ns2="http://www.i2b2.org/xsd/hive/pdo/1.1/" xmlns:ns6="http://www.i2b2.org/xsd/hive/msg/1.1/" xmlns:ns8="http://www.i2b2.org/xsd/cell/crc/psm/querydefinition/1.1/">';
  const REQUEST_MESSAGE_HEADER='<proxy><redirect_url>' + I2B2_ENDPOINT + '/i2b2/services/QueryToolService/request</redirect_url></proxy><sending_application><application_name>i2b2_QueryTool</application_name><application_version>1.6</application_version></sending_application><sending_facility><facility_name>PHS</facility_name></sending_facility><receiving_application><application_name>i2b2_DataRepositoryCell</application_name><application_version>1.6</application_version></receiving_application><receiving_facility><facility_name>PHS</facility_name></receiving_facility><message_type><message_code>Q04</message_code><event_type>EQQ</event_type></message_type><message_control_id><message_num>wvf0EEkA5zz9Wxj82Y3ey</message_num><instance_num>0</instance_num></message_control_id><processing_id><processing_id>P</processing_id><processing_mode>I</processing_mode></processing_id><accept_acknowledgement_type>messageId</accept_acknowledgement_type><project_id>Demo</project_id>';
  const REQUEST='<request_header> <result_waittime_ms>180000</result_waittime_ms> </request_header> <message_body> <ns4:psmheader> <user group="Demo" login="demo">demo</user> <patient_set_limit>0</patient_set_limit> <estimated_time>0</estimated_time> <query_mode>optimize_without_temp_table</query_mode> <request_type>CRC_QRY_runQueryInstance_fromQueryDefinition</request_type> </ns4:psmheader> <ns4:request xsi:type="ns4:query_definition_requestType" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"> <query_definition> <query_name>Princip-Seconda@10:50:45</query_name> <query_timing>ANY</query_timing> <specificity_scale>0</specificity_scale> <panel> <panel_number>1</panel_number> <panel_accuracy_scale>100</panel_accuracy_scale> <invert>0</invert> <panel_timing>ANY</panel_timing> <total_item_occurrences>1</total_item_occurrences> <item> <hlevel>1</hlevel> <item_key>\\\\ICD10_ICD9\\Diagnoses\\(P00-P96) Cert~6976\\</item_key> <item_name>Certain conditions originating in the perinatal period (p00-p96)</item_name> <tooltip>Diagnoses \\ Certain conditions originating in the perinatal period (p00-p96)</tooltip> <item_icon>FA</item_icon> <class>ENC</class> <constrain_by_modifier> <modifier_name>Principal Diagnosis</modifier_name> <applied_path>\\Diagnoses\\(P00-P96) Cert~6976\\%</applied_path> <modifier_key>\\\\ICD10_ICD9\\Principal Diagnosis\\</modifier_key> </constrain_by_modifier> <item_is_synonym>false</item_is_synonym> </item> </panel> <panel> <panel_number>2</panel_number> <panel_accuracy_scale>100</panel_accuracy_scale> <invert>0</invert> <panel_timing>ANY</panel_timing> <total_item_occurrences>1</total_item_occurrences> <item> <hlevel>1</hlevel> <item_key>\\\\ICD10_ICD9\\Diagnoses\\(P00-P96) Cert~6976\\</item_key> <item_name>Certain conditions originating in the perinatal period (p00-p96)</item_name> <tooltip>Diagnoses \\ Certain conditions originating in the perinatal period (p00-p96)</tooltip> <item_icon>FA</item_icon> <class>ENC</class> <constrain_by_modifier> <modifier_name>Secondary Diagnosis</modifier_name> <applied_path>\\Diagnoses\\(P00-P96) Cert~6976\\%</applied_path> <modifier_key>\\\\ICD10_ICD9\\Secondary Diagnosis\\</modifier_key> </constrain_by_modifier> <item_is_synonym>false</item_is_synonym> </item> </panel> </query_definition> <result_output_list><result_output priority_index="12" name="patientset"/> </result_output_list> </ns4:request> </message_body> </ns6:request>';
  const FULL_REQUEST=REQUEST_HEADER+'<message_header>'+REQUEST_MESSAGE_HEADER+SECURITY+'</message_header>'+REQUEST;
  const QUERY_RESPONSE = await got.post(I2B2_ENDPOINT + '/i2b2/services/QueryToolService/request', {headers:{"Content-Type":"application/xml"}, body:FULL_REQUEST});
  const QUERY_ID = parser.parse(QUERY_RESPONSE.body)['ns5:response'].message_body['ns4:response'].query_result_instance.result_instance_id;
  const PDO_REQUEST_HEADER='<?xml version="1.0" encoding="UTF-8" standalone="yes"?> <ns6:request xmlns:ns4="http://www.i2b2.org/xsd/cell/crc/psm/1.1/" xmlns:ns7="http://www.i2b2.org/xsd/cell/crc/psm/querydefinition/1.1/" xmlns:ns3="http://www.i2b2.org/xsd/cell/crc/pdo/1.1/" xmlns:ns5="http://www.i2b2.org/xsd/hive/plugin/" xmlns:ns2="http://www.i2b2.org/xsd/hive/pdo/1.1/" xmlns:ns6="http://www.i2b2.org/xsd/hive/msg/1.1/">';
  const PDO_REQUEST_MESSAGE_HEADER='<proxy><redirect_url>' + I2B2_ENDPOINT + '/i2b2/services/QueryToolService/pdorequest</redirect_url></proxy><sending_application><application_name>i2b2_QueryTool</application_name><application_version>1.6</application_version></sending_application><sending_facility><facility_name>PHS</facility_name></sending_facility><receiving_application><application_name>i2b2_DataRepositoryCell</application_name><application_version>1.6</application_version></receiving_application><receiving_facility><facility_name>PHS</facility_name></receiving_facility><message_type><message_code>Q04</message_code><event_type>EQQ</event_type></message_type><message_control_id><message_num>92N7S9ppn20H4ahrRja7y</message_num><instance_num>0</instance_num></message_control_id><processing_id><processing_id>P</processing_id><processing_mode>I</processing_mode></processing_id><accept_acknowledgement_type>messageId</accept_acknowledgement_type><project_id>Demo</project_id>';
  const PDO_REQUEST='<request_header><result_waittime_ms>180000</result_waittime_ms></request_header><message_body> <ns3:pdoheader> <patient_set_limit></patient_set_limit> <estimated_time>180000</estimated_time> <request_type>getPDO_fromInputList</request_type> </ns3:pdoheader> <ns3:request xsi:type="ns3:GetPDOFromInputList_requestType" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"> <input_list> <patient_list min="1" max="7"> <patient_set_coll_id>'+QUERY_ID+'</patient_set_coll_id> </patient_list> </input_list> <filter_list> <panel name="\\\\ICD10_ICD9\\Principal Diagnosis\\"> <panel_number>0</panel_number> <panel_accuracy_scale>0</panel_accuracy_scale> <invert>0</invert> <item> <hlevel>1</hlevel> <item_key>\\\\ICD10_ICD9\\Principal Diagnosis\\</item_key> <dim_tablename>MODIFIER_DIMENSION</dim_tablename> <dim_dimcode>\\Principal Diagnosis\\</dim_dimcode> <item_is_synonym>N</item_is_synonym> </item> </panel> <panel name="\\\\ICD10_ICD9\\Secondary Diagnosis\\"> <panel_number>0</panel_number> <panel_accuracy_scale>0</panel_accuracy_scale> <invert>0</invert> <item> <hlevel>1</hlevel> <item_key>\\\\ICD10_ICD9\\Secondary Diagnosis\\</item_key> <dim_tablename>MODIFIER_DIMENSION</dim_tablename> <dim_dimcode>\\Secondary Diagnosis\\</dim_dimcode> <item_is_synonym>N</item_is_synonym> </item> </panel> </filter_list> <output_option> <patient_set select="using_input_list" onlykeys="false"/> <observation_set blob="true" onlykeys="false"/> </output_option> </ns3:request> </message_body> </ns6:request>';
  const FULL_PDO_REQUEST=PDO_REQUEST_HEADER+'<message_header>'+PDO_REQUEST_MESSAGE_HEADER+SECURITY+'</message_header>'+PDO_REQUEST;
  const PDO_QUERY_RESPONSE = await got.post(I2B2_ENDPOINT + '/i2b2/services/QueryToolService/pdorequest', {headers:{"Content-Type":"application/xml"}, body:FULL_PDO_REQUEST});
  const PATIENT_DATA = parser.parse(PDO_QUERY_RESPONSE.body)['ns5:response'].message_body['ns3:response']['ns2:patient_data']['ns2:patient_set'];
  // ~MDC reduce/spread slow but neat:
  let dobs = PATIENT_DATA.patient.reduce((acc,item) => ({...acc, [item.patient_id]: item.param[5]}), {});
  const OBSERVATIONS = parser.parse(PDO_QUERY_RESPONSE.body)['ns5:response'].message_body['ns3:response']['ns2:patient_data']['ns2:observation_set'];
  let primaryPatients = OBSERVATIONS[0].observation;
  // Sort, so reduce picks up latest encounter as last value for dictionary.
  primaryPatients.sort((a,b)=>new Date(a.end_date).getTime()-new Date(b.end_date).getTime());
  let lastEncountersPrimary = primaryPatients.reduce((acc,item) => ({...acc, [item.patient_id]: item.end_date}), {});
  let secondaryPatients = OBSERVATIONS[1].observation;
  secondaryPatients.sort((a,b)=>new Date(a.end_date).getTime()-new Date(b.end_date).getTime());
  let lastEncountersSecondary = primaryPatients.reduce((acc,item) => ({...acc, [item.patient_id]: item.end_date}), {});
  let lastEncounter = {...lastEncountersPrimary, ...lastEncountersSecondary};
  let patients = {};
  for(let patient of primaryPatients) patients=patientToCodes(patients, patient.patient_id, patient.concept_cd);
  for(let patient of secondaryPatients) patients=patientToCodes(patients, patient.patient_id, patient.concept_cd);
  await fs.appendFile('covid-potential-cases.csv', "patient-id,dob,codes,last-encounter\n");

  for(let patient in patients) {
    try {
      await fs.appendFile('covid-potential-cases.csv', patient+","+dobs[patient]+",\""+Array.from(patients[patient]).join(",")+"\","+lastEncounter[patient].substring(0,lastEncounter[patient].length-1)+"\n");
    } catch(error) {
      console.log(error);
    }
  }

})();
