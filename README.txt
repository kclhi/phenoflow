env:
DEFAULT_PASSWORD=
MYSQL_ROOT_PASSWORD=
MYSQL_USER=
MYSQL_PASSWORD=
MYSQL_DATABASE=
NODE_EXTRA_CA_CERTS=
HOST_RSA_PRIVATE_KEY_PATH=

cert locations:
- visualiser/git-server/certs (generate)
- visualiser/spring/certs/pf.pem
- web/certs/pf.pem
- web/certs/rsa-private-key.pem (openssl genrsa -out key.pem 2048)
- web/proxy/certs/pf.*
- web/proxy/certs (generate)

db encryption:
- web/db/encrypt/keys (generate)

other:
- .htpasswd to /web/proxy/certs
- Add images to web/public/images
- Create web/uploads
- Grab git@github.com:kclhi/phenotype-id.github.io.git

build and run:
visualiser/
docker-compose build;
docker-compose up -d;
web/
docker-compose build;
docker-compose up -d;

tests (loads some phenotypes):
docker-compose -f docker-compose.test.yml build;
docker-compose -f docker-compose.test.yml up;
