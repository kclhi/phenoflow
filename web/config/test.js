module.exports = {
  user:{
    DEFAULT_PASSWORD: "1234"
  },
  dbConfig: {
	  dialect: "sqlite",
	  storage: "db.test.sqlite",
    logging: false
  },
  jwt: {
    RSA_PRIVATE_KEY: "abc",
    RSA_PUBLIC_KEY: "abc"
  }
}
