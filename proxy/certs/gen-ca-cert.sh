#!/usr/bin/env bash
set -eu
org=phenoflow-ca
openssl genpkey -algorithm RSA -out phenoflow.key -pkeyopt rsa_keygen_bits:4096
openssl req -x509 -key phenoflow.key -days 365 -outform PEM -out phenoflow.pem -subj "/CN=$org/O=$org"
