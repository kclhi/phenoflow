const fs = require('fs');
const raw = require('config/raw').raw;

module.exports = {
  dbConfig: {
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    host: "phenoflow_mariadb_1",
    dialect: "mysql",
    logging: false
  },
  user: {
    DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD
  },
  generator: {
    URL: "http://generator:3004"
  },
  visualiser: {
    URL: "http://spring:8080"
  },
  gitserver: {
    PREFIX: "https://",
    HOST: "git-server",
    CONTAINER_HOST: "git-server",
    PORT: ":7005"
  },
  jwt: {
    RSA_PRIVATE_KEY: raw(fs.readFileSync("/run/secrets/rsa-private-key", "utf-8"))
  }
}
