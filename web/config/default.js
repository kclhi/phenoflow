module.exports = {
  workflow: {
    LANGUAGES: ["knime", "python", "js"]
  },
  generator: {
    URL: "http://localhost:3001"
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
