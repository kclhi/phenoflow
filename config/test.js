const fs = require('fs');
const raw = require('config/raw').raw;

module.exports = {
  dbConfig: {
    dialect: "sqlite",
    storage: "db.test.sqlite",
    logging: false
  },
  jwt: {
    RSA_PRIVATE_KEY: raw(fs.readFileSync(process.env.RSA_PRIVATE_KEY_FULL_PATH.toString(), "utf-8"))
  }
}
