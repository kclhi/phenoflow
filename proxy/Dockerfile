FROM nginx
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./servers /etc/nginx/servers
COPY ./certs/phenoflow.crt /etc/nginx/ssl/phenoflow.crt
COPY ./certs/phenoflow.key /etc/nginx/ssl/phenoflow.key
COPY ./certs/.htpasswd /etc/nginx/.htpasswd
COPY ./bin/wait-for-it.sh wait-for-it.sh
CMD ["nginx", "-g", "daemon off;"]
