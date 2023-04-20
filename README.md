<img src="logo.png" alt="phenoflow" width="150">

Parser - Parse phenotype codelists, keyword lists or Phenoflow-based steplists

[![StackShare](http://img.shields.io/badge/tech-stack-0690fa.svg?style=flat)](https://stackshare.io/martinchapman/phenoflow)

## Prerequisites

1. [Docker (machine)](https://docs.docker.com/machine/install-machine/).
2. [Python 3](https://www.python.org/downloads/release/python-370/).

### Install and Run

1. Create a node virtual environment (within a python virtual environment), and activate it:

```
python -m venv .venv
. .venv/bin/activate
pip install nodeenv
nodeenv .nenv
. .nenv/bin/activate
```

2. Install dependencies:

```
cat requirements.txt | xargs npm install -g
```

3. Run server:

```
npm start
```

## Deployment

1. Deployment is via Docker. If using remote machine, ensure it is activated:

```
docker context use [machine-name]
```

2. From the root directory, build container:

```
docker-compose build
```

3. Run container:

```
docker-compose up -d
```

## Tests

### Development

- Run all tests:

`npm test`

- Run specific test(s), e.g.:

`NODE_ENV=test npx mocha -g "basic" --exit`

### Deployment

- From the root directory run:

```
docker-compose -f docker-compose.test.yml build;
docker-compose -f docker-compose.test.yml up;
```

[Tests can also be used to import phenotypes from different data sources](test#tests).

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/martinchapman/nokia-health/tags).

## Authors

[kclhi](https://kclhi.org)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
