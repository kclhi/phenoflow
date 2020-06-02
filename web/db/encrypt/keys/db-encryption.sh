echo -n "1;" >> keyfile
sudo openssl rand -hex 32 >> keyfile
echo -n "2;" >> keyfile
sudo openssl rand -hex 32 >> keyfile
echo -n "100;" >> keyfile
sudo openssl rand -hex 32 >> keyfile
sudo openssl rand -hex 128 > keyfile.key
sudo openssl enc -aes-256-cbc -md sha1 -pass file:keyfile.key -in keyfile -out keyfile.enc
rm keyfile
