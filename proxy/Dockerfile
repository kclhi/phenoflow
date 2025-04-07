FROM nginx
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./servers /etc/nginx/servers
COPY ./certs/phenoflow-proxy-1.crt /etc/nginx/ssl/phenoflow-proxy-1.crt
COPY ./certs/phenoflow-proxy-1.key /etc/nginx/ssl/phenoflow-proxy-1.key
COPY ./bin/wait-for-it.sh wait-for-it.sh
CMD ["nginx", "-g", "daemon off;"]
