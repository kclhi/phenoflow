const fs = require('fs');
const raw = require('config/raw').raw;

module.exports = {
  dbConfig: {
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    host: "importer_mariadb_1",
    dialect: "mysql",
    logging: false
  },
  user: {
    DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD
  },
  parser: {
    URL: "http://parser_webapp_1:3005"
  },
  generator: {
    URL: "http://generator:3004"
  },
  jwt: {
    RSA_PRIVATE_KEY: raw(fs.readFileSync("/run/secrets/rsa-private-key", "utf-8"))
  }
}
