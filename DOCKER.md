# Docker Setup Guide

This guide provides detailed information about running the CXPM AI PRD application in Docker.

## Overview

The application is containerized using AlmaLinux 9 as the base image, with Node.js v24.11.1 and npm 11.6.2 installed via nvm.

## Files

- **Dockerfile** - Defines the container image
- **docker-compose.yml** - Docker Compose configuration for easy management
- **.dockerignore** - Files to exclude from the Docker build context
- **docker_run.sh** - Automated script to build and run the container

## Quick Start

### Using the automated script (Recommended)

```bash
./docker_run.sh
```

This script will:
1. Check if Docker is installed and running
2. Stop and remove any existing container
3. Build the Docker image
4. Start the container with proper configuration
5. Display useful management commands

### Using Docker Compose

```bash
# Build and start in detached mode
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop
docker-compose down

# Restart
docker-compose restart
```

### Using Docker commands directly

```bash
# Build the image
docker build -t cxpm-ai-prd .

# Run the container
docker run -d \
  --name cxpm-ai-prd-app \
  -p 3000:3000 \
  -v $(pwd)/ui/src:/app/ui/src \
  -v $(pwd)/ui/public:/app/ui/public \
  cxpm-ai-prd

# View logs
docker logs -f cxpm-ai-prd-app

# Stop the container
docker stop cxpm-ai-prd-app

# Remove the container
docker rm cxpm-ai-prd-app
```

## Dockerfile Details

### Base Image
- **almalinux:9** - Enterprise Linux distribution

### Installed Components
- Development Tools (gcc, make, etc.)
- git, curl, wget, lsof
- nvm (Node Version Manager)
- Node.js v24.11.1
- npm 11.6.2

### Build Process
1. Updates system packages
2. Installs system dependencies
3. Installs nvm and Node.js
4. Creates system-wide symlinks
5. Copies application files
6. Installs npm dependencies
7. Configures to run on port 3000

### Exposed Ports
- **3000** - Vite development server

## Docker Compose Features

The `docker-compose.yml` configuration includes:

### Volume Mounts
- `./ui/src:/app/ui/src` - Hot reload for source code changes
- `./ui/public:/app/ui/public` - Public assets
- `node_modules` - Named volume for better performance

### Environment
- `NODE_ENV=development` - Development mode

### Networking
- Maps port 3000 from container to host

### Auto-restart
- `restart: unless-stopped` - Automatically restarts on failure

## Development Workflow

### Making Code Changes

With Docker Compose, code changes in `ui/src/` are automatically reflected due to volume mounting and Vite's hot reload:

1. Edit files in `ui/src/`
2. Save the file
3. Refresh your browser at `http://localhost:3000`

### Installing New npm Packages

If you need to add new packages:

```bash
# Stop the container
docker-compose down

# Add package to ui/package.json manually, or:
docker-compose run cxpm-ai-prd npm install <package-name>

# Rebuild and start
docker-compose up --build -d
```

### Rebuilding the Image

After changes to:
- `Dockerfile`
- `package.json` (dependencies)
- Build configuration

Rebuild the image:

```bash
docker-compose up --build -d
# or
docker build -t cxpm-ai-prd . --no-cache
```

## Troubleshooting

### Container won't start

Check logs:
```bash
docker-compose logs
# or
docker logs cxpm-ai-prd-app
```

### Port already in use

Stop any processes using port 3000:
```bash
# Find process
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)

# Or change the port in docker-compose.yml:
ports:
  - "3001:3000"  # Use 3001 on host instead
```

### Permission denied errors

Ensure Docker daemon is running and you have permissions:
```bash
# Check Docker status
docker info

# Add user to docker group (Linux)
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

### Image build fails

Try building without cache:
```bash
docker-compose build --no-cache
# or
docker build -t cxpm-ai-prd . --no-cache
```

### Hot reload not working

Ensure volume mounts are correct and container can write to those directories.

## Production Deployment

For production, you should:

1. Create a production Dockerfile that builds optimized assets:

```dockerfile
# ... build stage ...
RUN npm run build

# Use a lightweight web server
FROM nginx:alpine
COPY --from=build /app/ui/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

2. Use environment variables for configuration
3. Implement proper logging
4. Set up health checks
5. Use orchestration tools (Kubernetes, Docker Swarm)

## Useful Commands

```bash
# View container resource usage
docker stats cxpm-ai-prd-app

# Access container shell
docker exec -it cxpm-ai-prd-app /bin/bash

# Copy files from container
docker cp cxpm-ai-prd-app:/app/ui/dist ./dist

# Inspect container
docker inspect cxpm-ai-prd-app

# Remove all stopped containers
docker container prune

# Remove unused images
docker image prune
```

## Security Considerations

- The container runs as root by default (suitable for development)
- For production, create a non-root user
- Keep the base image updated: `docker pull almalinux:9`
- Scan images for vulnerabilities: `docker scan cxpm-ai-prd`
- Don't include sensitive data in the image
- Use secrets management for credentials

## Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [AlmaLinux Documentation](https://wiki.almalinux.org/)
- [Best practices for writing Dockerfiles](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
