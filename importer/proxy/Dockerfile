FROM nginx
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./servers /etc/nginx/servers
COPY ./certs/importer.crt /etc/nginx/ssl/importer.crt
COPY ./certs/importer.key /etc/nginx/ssl/importer.key
COPY ./bin/wait-for-it.sh wait-for-it.sh
CMD ["nginx", "-g", "daemon off;"]
