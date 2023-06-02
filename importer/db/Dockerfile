FROM mariadb:10
ADD ./my.cnf /etc/mysql/conf.d/
ADD ./encrypt/encrypt.cnf /etc/mysql/conf.d/
ADD ./encrypt/keys/keyfile.enc  /etc/mysql/encryption/
RUN chown mysql:mysql /etc/mysql/encryption/keyfile.enc
RUN chmod go-rwx /etc/mysql/encryption/keyfile.enc
ADD ./encrypt/keys/keyfile.key  /etc/mysql/encryption/
RUN chown mysql:mysql /etc/mysql/encryption/keyfile.key
RUN chmod go-rwx /etc/mysql/encryption/keyfile.key
EXPOSE 3306
