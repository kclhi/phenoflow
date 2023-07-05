const fs = require('fs');
const raw = require('config/raw').raw;

module.exports = {
  dbConfig: {
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    host: "importer-mariadb-1",
    dialect: "mysql",
    logging: false
  },
  user: {
    DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD
  },
  parser: {
    URL: "https://parser-webapp-1:3005"
  },
  generator: {
    URL: "https://generator-webapp-1:3004"
  },
  github: {
    BASE_URL: "https://api.github.com",
    ACCESS_TOKEN: process.env.GITHUB_ACCESS_TOKEN,
    REPOSITORY_PREFIX: "https://github.com/phenoflow",
    ZENODO_WEBHOOK: process.env.GITHUB_ZENODO_WEBHOOK
  },
  jwt: {
    RSA_PRIVATE_KEY: raw(fs.readFileSync("/run/secrets/rsa-private-key", "utf-8"))
  }
}
