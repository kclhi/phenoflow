#!/usr/bin/env bash
set -eu
name=pf
org=pf-ca
domain=git-server
openssl genpkey -algorithm RSA -outform PEM -out "$domain"-key.pem -pkeyopt rsa_keygen_bits:4096
openssl req -new -key "$domain"-key.pem -out "$domain".csr -subj "/CN=$domain/O=$org"
openssl x509 -req -in "$domain".csr -days 365 -outform PEM -CA "$name".pem -CAkey "$name".key -CAcreateserial \
    -extfile <(cat <<END
basicConstraints = CA:FALSE
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName = DNS:$domain, DNS:localhost
END
    ) \
    -out "$domain"-cert.pem
