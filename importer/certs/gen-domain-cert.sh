#!/usr/bin/env bash
set -eu
name=phenoflow
org=phenoflow-ca
domain=importer
openssl genpkey -algorithm RSA -out "$domain".key -pkeyopt rsa_keygen_bits:4096
openssl req -new -key "$domain".key -out "$domain".csr -subj "/CN=$domain/O=$org"
openssl x509 -req -in "$domain".csr -days 365 -out "$domain".crt -CA "$name".pem -CAkey "$name".key -CAcreateserial \
  -extfile <(cat <<END
basicConstraints = CA:FALSE
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName = DNS:$domain, DNS:localhost
END
    )
