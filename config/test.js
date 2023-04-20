const fs = require('fs');
const raw = require('config/raw').raw;

module.exports = {
  dbConfig: {
    dialect: "sqlite",
    storage: "db.test.sqlite",
    logging: false
  },
  user:{
    DEFAULT_PASSWORD: "password"
  },
  jwt: {
    RSA_PRIVATE_KEY: raw(fs.readFileSync(process.env.RSA_PRIVATE_KEY_FULL_PATH.toString(), "utf-8"))
  },
  importer: {
    SAIL_API: "https://conceptlibrary.saildatabank.com/api",
    SAIL_USERNAME: process.env.SAIL_USERNAME,
    SAIL_PASSWORD: process.env.SAIL_PASSWORD
  },
  github: {
    BASE_URL: "https://github.kcl.ac.uk/api/v3",
    ACCESS_TOKEN: process.env.GHE_ACCESS_TOKEN,
    ORGANISATION_SSH: "git@github.kcl.ac.uk:phenoflow"
  }
}
