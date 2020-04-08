#!/usr/bin/env bash
set -eu
org=pf-ca
openssl genpkey -algorithm RSA -out pf.key
openssl req -x509 -key pf.key -days 365 -outform PEM -out pf.pem -subj "/CN=$org/O=$org"
