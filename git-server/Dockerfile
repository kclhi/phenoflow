FROM node:11

ENV user node

COPY package.json /home/$user/
COPY certs/ /home/$user/
COPY . /home/$user/

WORKDIR /home/$user

RUN chown $user --recursive .

USER $user

RUN npm install

ENV NODE_ENV production
EXPOSE 7005
CMD ["npm", "start"]
