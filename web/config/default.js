module.exports = {
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
  parser: {
    URL: "http://localhost:3005"
  },
  gitserver: {
    PREFIX: "https://",
    HOST: "localhost",
    CONTAINER_HOST: "git-server",
    PORT: ":7005"
  },
  importer: {
    PHENOTYPE_FOLDER: "fixtures/importer/caliber",
    CODELIST_FOLDER: "fixtures/importer/phekb",
    KEYWORD_LIST_FOLDER: "fixtures/importer/kclhi",
    GROUP_SIMILAR_PHENOTYPES: false
  },
  zenodo: {
    URL: "sandbox.zenodo.org",
    ACCESS_TOKEN: process.env.ZENODO_ACCESS_TOKEN
  }
};
