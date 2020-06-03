FROM node:11
ENV user node
WORKDIR /home/$user/app
RUN chown $user -R /home/$user/app
USER $user
COPY --chown=$user:$user package*.json ./
RUN npm install --only=production
COPY --chown=$user:$user . .
ENV NODE_ENV production
EXPOSE 3003
CMD ["npm", "start"]
