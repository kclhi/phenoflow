<img src="logo.png" alt="phenoflow" width="150">

Portable, workflow-based phenotype definitions.

[https://kclhi.org/phenoflow](https://kclhi.org/phenoflow)

Cite as _[Phenoflow: A Microservice Architecture for Portable Workflow-based Phenotype Definitions](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8378606/). Chapman, Martin et al. AMIA Summits on Translational Science. 2021._

___

Components of the Phenoflow architecture.

[![StackShare](http://img.shields.io/badge/tech-stack-0690fa.svg?style=flat)](https://stackshare.io/martinchapman/phenoflow)

## Prerequisites

### Certificate generation

1. Run [importer/proxy/certs/gen-ca-cert.sh](importer/proxy/certs/gen-ca-cert.sh).
2. Run [importer/proxy/certs/gen-domain-cert.sh](importer/proxy/certs/gen-domain-cert.sh).
3. Copy importer/proxy/certs/pf.* to [generator/certs](generator/certs).
4. Run [generator/certs/gen-domain-cert.sh](generator/certs/gen-domain-cert.sh).
5. Copy importer/certs/pf.* to [parser/certs](parser/certs).
6. Run [parser/certs/gen-domain-cert.sh](parser/certs/gen-domain-cert.sh).

## Install, run and deploy

Follow steps in [generator](generator#readme), [parser](parser#readme), [importer](importer#readme) and [visualiser](visualiser#readme).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/martinchapman/phenoflow/tags).

## Authors

[kclhi](https://kclhi.org)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

* [python-cwlgen](https://github.com/kclhi/python-cwlgen)
* [cwlviewer](https://github.com/kclhi/cwlviewer)
