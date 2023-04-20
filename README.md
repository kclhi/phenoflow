<img src="logo.png" alt="phenoflow" width="150">

Generator - Serviced-based version of CWL generator

[![StackShare](http://img.shields.io/badge/tech-stack-0690fa.svg?style=flat)](https://stackshare.io/martinchapman/phenoflow)

## Prerequisites

1. [Python 3](https://www.python.org/downloads/release/python-370/).
2. [Docker (machine)](https://docs.docker.com/machine/install-machine/).

## Development
### Install and Run
#### Generator

1. Initialise a virtual environment, and activate:

```
python -m venv .venv
. .venv/bin/activate
```

2. Install dependencies:

```
pip install -r requirements.txt
```

3. Run generator:

```
python main.py
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

1. Run all tests:

```
python -m unittest
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/martinchapman/nokia-health/tags).

## Authors

[kclhi](https://kclhi.org)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments

* [python-cwlgen](https://github.com/kclhi/python-cwlgen).
* [cwlviewer](https://github.com/kclhi/cwlviewer).
