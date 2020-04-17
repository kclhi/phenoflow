module.exports = {
  workflow: {
    LANGUAGES: ["knime", "python", "js"],
    CONCEPTS: ["load", "logic", "boolean", "output"]
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
