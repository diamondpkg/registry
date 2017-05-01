# Registry
The diamond registry.

## Instaling
First you need [Docker](https://www.docker.com/)

Make a file named `docker-compose.yml` with the following content.
```bash
# Dowload docker-compose.yml
wget https://raw.githubusercontent.com/diamondpkg/registry/master/docker-compose.yml

# Start
`docker-compose up -d`

# The server should be up within a few seconds at https://localhost:8000
```