## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

Before starting, [download and install python](https://www.python.org/downloads/), [pip](https://packaging.python.org/tutorials/installing-packages/#use-pip-for-installing), [virtualenv](https://virtualenv.pypa.io/en/latest/installation/) and [Node.js](https://nodejs.org/en/download/).

## Documentation

[View]().

## Editing

This is an [express](https://expressjs.com/) (lightweight server) project. The majority of the logic is contained within [app.js](app.js), and in the routes and lib folders.

## Configuration

Modify `config/default.js`.

Create an environment file:

```
touch .env
```

[Setup db encryption keys](https://mariadb.com/kb/en/file-key-management-encryption-plugin/) in `db`.

Migrations can be reverse engineered from model updates using the [makemigration](https://www.npmjs.com/package/sequelize-auto-migrations) command.

## Running

Ensure you are in the root folder. Create a node virtual environment (within a python virtual environment), and activate it:

```
virtualenv env
. env/bin/activate
pip install nodeenv
nodeenv nenv
. nenv/bin/activate
```

Install dependencies:

```
cat requirements.txt | xargs npm install -g
```

Run server:

```
npm start
```

The server runs by default on port 3000. Visit localhost:3000/[route] to test changes to GET endpoints and use software such as [Postman](https://www.getpostman.com/) to test changes to POST (and other) endpoints.

## Running the tests

Run both unit and lint tests using `npm`:

```
npm test
```

## Deployment

Deployment is via [Docker](https://docs.docker.com/compose/install/), and includes containers for this application, a production SQL database and an optional reverse proxy. If using the reverse proxy, fill in the appropriate [configuration](proxy/nginx.conf).

Build these containers:

```
docker-compose build
```

Run these containers:

```
docker-compose up
```

## Built With

* [Express](https://expressjs.com/) - Web framework.
