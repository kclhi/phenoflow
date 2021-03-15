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
    RSA_PRIVATE_KEY: "abcd"
  },
  importer: {
    SAIL_API: "https://conceptlibrary.saildatabank.com/api",
    SAIL_USERNAME: process.env.SAIL_USERNAME,
    SAIL_PASSWORD: process.env.SAIL_PASSWORD
  }
}
