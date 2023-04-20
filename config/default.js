module.exports = {
  phenoflow: {
    HOMEPAGE: "https://kclhi.org/phenoflow"
  },
  workflow: {
    LANGUAGES: ["knime", "python", "js"],
    CONCEPTS: ["load", "external", "logic", "boolean", "output"]
  },
  generator: {
    URL: "http://localhost:3004"
  },
  parser: {
    URL: "http://localhost:3005"
  },
  importer: {
    PHENOTYPE_FOLDER: "fixtures/importer/caliber",
    CODELIST_FOLDER: "fixtures/importer/phekb",
    KEYWORD_LIST_FOLDER: "fixtures/importer/kclhi",
    GROUP_SIMILAR_PHENOTYPES: false,
    HDR_API: "https://phenotypes.healthdatagateway.org/api/v1",
  },
  github: {
    BASE_URL: "https://api.github.com",
    ACCESS_TOKEN: process.env.GITHUB_ACCESS_TOKEN,
    ORGANISATION_SSH: "git@github.com:phenoflow"
  }
};
