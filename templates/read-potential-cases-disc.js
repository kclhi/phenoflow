// martinchapman, 2020

const fs = require('fs').promises;
const parse = require('neat-csv');

(async () => {

  let potentialCases;
  try {
    potentialCases = await fs.readFile(process.argv.slice(2)[0]);
  } catch(error) {
    console.error("Could not read input: "+error);
  }
  try {
    potentialCases = await parse(potentialCases);
  } catch(error) {
    console.error("Could not parse CSV: "+error);
  }
  await fs.writeFile('[PHENOTYPE]-potential-cases.csv', Object.keys(potentialCases[0]).join(",")+"\n");
  for(let line of potentialCases) await fs.appendFile('[PHENOTYPE]-potential-cases.csv', Object.values(line).join(",")+"\n");

})();
