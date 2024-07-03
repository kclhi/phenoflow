module.exports = {
  phenoflow: {
    HOMEPAGE: "https://kclhi.org/phenoflow"
  },
  workflow: {
    LANGUAGES: ["knime", "python", "js"],
    CONCEPTS: ["load", "external", "logic", "boolean", "output"]
  },
  user:{
    DEFAULT_PASSWORD: "password"
  },
  generator: {
    URL: "https://localhost:3004"
  },
  parser: {
    URL: "https://localhost:3005"
  },
  importer: {
    BASE_FOLDER: "fixtures/importer",
    PHENOTYPE_FOLDER: "fixtures/importer/caliber",
    CODELIST_FOLDER: "fixtures/importer/phekb",
    KEYWORD_LIST_FOLDER: "fixtures/importer/kclhi",
    GROUP_SIMILAR_PHENOTYPES: false,
    HDR_API: "https://phenotypes.healthdatagateway.org/api/v1",
    SAIL_API: "https://conceptlibrary.saildatabank.com/api",
    SAIL_USERNAME: process.env.SAIL_USERNAME,
    SAIL_PASSWORD: process.env.SAIL_PASSWORD
  },
  github: {
    BASE_URL: "https://github.kcl.ac.uk/api/v3",
    ACCESS_TOKEN: process.env.GHE_ACCESS_TOKEN,
    REPOSITORY_PREFIX: "https://github.kcl.ac.uk/phenoflow",
    ZENODO_WEBHOOK: process.env.GHE_ZENODO_WEBHOOK,
    EXPECTED_BRANCH_COUNT: 5
  }
};
