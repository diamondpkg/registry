FROM node:latest

# Create the directory!
RUN mkdir -p /usr/src/registry
WORKDIR /usr/src/registry

# Copy and Install
COPY ./*.js /usr/src/registry/
COPY ./html/ /usr/src/registry/html/
COPY ./v1/ /usr/src/registry/v1/
COPY ./ssl/ /usr/src/registry/ssl/
COPY package.json /usr/src/registry/
RUN npm install

# Start me!
CMD ["node", "index.js"]

EXPOSE 8000
