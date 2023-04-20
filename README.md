<img src="logo.png" alt="phenoflow" width="150">

Visualiser - CWL Viewer with associated git host

[![StackShare](http://img.shields.io/badge/tech-stack-0690fa.svg?style=flat)](https://stackshare.io/martinchapman/phenoflow)

## Development

### Install and Run

#### Visualiser

- Local execution is only available via Docker:

```
docker-compose -f docker-compose.dev.yml build
docker-compose -f docker-compose.dev.yml up -d
```

## Deployment

1. Deployment is also via Docker. If using remote machine, ensure it is activated:

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
