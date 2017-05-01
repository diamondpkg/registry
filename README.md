# Registry
The diamond registry.

## Instaling
First you need [Docker](https://www.docker.com/)
```bash
# Clone the project
git clone https://github.com/diamondpkg/registry.git

# Build the project
docker build -t diamondpkg/registry .

# Run the project with docker-compose
docker-compose up -d

# The server should be up within a few seconds at https://localhost:8000
```