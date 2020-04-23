module.exports = {
  dbConfig: {
    username: "user",
    password: "password",
    database: "database",
    host: "phenoflow_mariadb_1",
    dialect: "mysql"
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
    RSA_PRIVATE_KEY: process.env.RSA_PRIVATE_KEY,
    RSA_PUBLIC_KEY: process.env.RSA_PUBLIC_KEY
  }
}
