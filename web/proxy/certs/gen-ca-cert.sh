#!/usr/bin/env bash
set -eu
org=martinchapman-ca
openssl genpkey -algorithm RSA -out martinchapman.key
openssl req -x509 -key martinchapman.key -days 365 -out martinchapman.crt -subj "/CN=$org/O=$org"
