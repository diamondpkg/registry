# Registry
The diamond registry.

## Instaling
First you need [Docker](https://www.docker.com/)

Make a file named `docker-compose.yml` with the following content.
```yaml
version: '3'
services:
  registry:
    image: "diamondpkg/registry"
    restart: always
    container_name: registry
    ports:
      - 8000:8000
    environment:
      - NODE_ENV=production
      - DIALECT=postgres
      - DB=registry
      - HOST=registry_db
      - USER=username
      - PASSWORD=password
  registry_db:
    image: "postgres:9"
    container_name: registry_db
    environment:
      - POSTGRES_DB=registry
      - POSTGRES_USER=username
      - POSTGRES_PASSWORD=password
```

Run `docker-compose up -d`

The server should be up within a few seconds at https://localhost:8000