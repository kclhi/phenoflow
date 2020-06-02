const fs = require('fs');
const raw = require('config/raw').raw;

module.exports = {
  dbConfig: {
	  dialect: "sqlite",
	  storage: "db.dev.sqlite",
    logging: false
  },
  user:{
    DEFAULT_PASSWORD: "1234"
  },
  jwt: {
    RSA_PRIVATE_KEY: raw(fs.readFileSync("certs/rsa-private-key.pem", "utf-8"))
  }
}
