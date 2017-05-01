FROM node:latest

# Create the directory!
RUN mkdir -p /usr/src/bot
WORKDIR /usr/src/bot

# Copy and Install
COPY ./*.js /usr/src/bot/
COPY ./package.json /usr/src/bot/
RUN npm install

# Start me!
CMD ["node", "index.js"]

EXPOSE 8000
