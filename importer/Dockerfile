FROM node:16
ENV user node
WORKDIR /home/$user/app
RUN chown $user -R /home/$user/app
USER $user
COPY --chown=$user:$user package*.json ./
ENV NODE_ENV production
RUN npm ci --only=production --loglevel=silly
COPY --chown=$user:$user . .
EXPOSE 3003
CMD ["npm", "start"]
