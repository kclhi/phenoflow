const fs = require('fs').promises;
const parser = require('fast-xml-parser');

(async () => {

  let options = {
    attributeNamePrefix: '@_',
    attrNodeName: false,
    ignoreAttributes: false
  };

  const potentialCases = await fs.readFile(process.argv.slice(2)[0], "utf8");
  const parsedRecord = parser.parse(potentialCases, options);
  await fs.appendFile('otitis-potential-cases.csv', "patient-id,dob,codes\n");

  try {
     await fs.appendFile('otitis-potential-cases.csv', "\"" + parsedRecord["Response"]["Identity"]["NHSNumber"]+"\",\""+parsedRecord["Response"]["Demographics"]["DateOfBirth"]+"\",\""+parsedRecord["Response"]["Clinical"]["Event"]["ClinicalCode"]["Code"]["@_Code"]+"\"\n");
  } catch(error) {
     console.log(error);
  }

})();
