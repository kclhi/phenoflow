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
    RSA_PRIVATE_KEY: "abc"
  }
}
