#!/usr/bin/env bash
set -eu
org=martinchapman-ca
domain=phenoflow
openssl genpkey -algorithm RSA -out "$domain".key
openssl req -new -key "$domain".key -out "$domain".csr -subj "/CN=$domain/O=$org"
openssl x509 -req -in "$domain".csr -days 365 -out "$domain".crt -CA martinchapman.crt -CAkey martinchapman.key -CAcreateserial \
    -extfile <(cat <<END
basicConstraints = CA:FALSE
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName = DNS:$domain
END
    )
