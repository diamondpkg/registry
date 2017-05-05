# Registry
The diamond registry.

## Instaling
First you need [Docker](https://www.docker.com/)

```bash
# Dowload docker-compose.yml
wget https://raw.githubusercontent.com/diamondpkg/registry/master/docker-compose.yml.example docker-compose.yml

# Edit docker-compose.yml

# Start
docker-compose up -d

# The server should be up within a few seconds at https://localhost:8000
```