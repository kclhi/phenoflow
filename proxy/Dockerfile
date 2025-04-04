FROM nginx
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./servers /etc/nginx/servers
COPY ./bin/wait-for-it.sh wait-for-it.sh
CMD ["nginx", "-g", "daemon off;"]
