module.exports = {
  ui: {
    PAGE_OFFSET: 10,
    PAGE_LIMIT: 10
  },
  user:{
    DEFAULT_PASSWORD: process.env.DEFAULT_PASSWORD
  },
  workflow: {
    LANGUAGES: ["knime", "python", "js"],
    CONCEPTS: ["load", "logic", "boolean", "output"]
  },
  generator: {
    URL: "http://localhost:3004"
  },
  visualiser: {
    URL: "http://localhost:8080"
  },
  gitserver: {
    PREFIX: "https://",
    HOST: "localhost",
    CONTAINER_HOST: "git-server",
    PORT: ":7005"
  },
};
