module.exports = {
  ui: {
    PAGE_LIMIT: 100
  },
  workflow: {
    LANGUAGES: ["knime", "python", "js"],
    CONCEPTS: ["load", "external", "logic", "boolean", "output"]
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
  importer: {
    CSV_FOLDER: "hdr-caliber-phenome-portal",
    GROUP_SIMILAR_PHENOTYPES: false
  }
};
