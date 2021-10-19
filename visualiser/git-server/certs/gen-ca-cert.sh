#!/usr/bin/env bash
set -eu
org=pf-ca
openssl genpkey -algorithm RSA -out pf.key -pkeyopt rsa_keygen_bits:4096
openssl req -new -x509 -key pf.key -days 365 -outform PEM -out pf.pem -subj "/CN=$org/O=$org"
