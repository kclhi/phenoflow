const fs = require('fs');
const raw = require('config/raw').raw;

module.exports = {
  dbConfig: {
	  dialect: "sqlite",
	  storage: "db.test.sqlite",
    logging: false
  },
  user:{
    DEFAULT_PASSWORD: "1234"
  },
  jwt: {
    RSA_PRIVATE_KEY: "abcd"
  }
}
