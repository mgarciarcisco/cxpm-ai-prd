# CXPM AI PRD

A web application built with React 18 and Vite.

## Quick Start

### Option 1: Docker (Recommended)

The easiest way to run the application is using Docker:

```bash
./docker_run.sh
```

This will:
- Build a Docker image with AlmaLinux 9
- Install Node.js v24.11.1 and npm 11.6.2
- Start the container and application
- Enable hot reload for development

The application will be available at `http://localhost:3000`

For detailed Docker documentation, see [DOCKER.md](DOCKER.md)

**Manual Docker commands:**

```bash
# Using Docker Compose
docker-compose up --build -d

# Or using plain Docker
docker build -t cxpm-ai-prd .
docker run -d -p 3000:3000 --name cxpm-ai-prd-app cxpm-ai-prd
```

### Option 2: Direct Installation (AlmaLinux)

If you're setting up on a fresh AlmaLinux system, first install system dependencies:

```bash
sudo ./install_dependencies_alma.sh
```

This will install:
- Node.js v24.11.1 (using nvm)
- npm 11.6.2
- Development tools (gcc, make, git)
- Required utilities (lsof, curl, wget)
- EPEL repository

Then run the application:

```bash
./run_app.sh
```

This script will:
- Check and install dependencies if needed
- Detect and kill any existing instances running on port 3000
- Start the development server

The application will be available at `http://localhost:3000`

## Manual Setup

If you prefer to run manually:

1. Navigate to the ui directory:
   ```bash
   cd ui
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```
cxpm-ai-prd/
├── ui/                              # React application
│   ├── src/                        # Source files
│   ├── package.json                # Dependencies
│   ├── vite.config.js              # Vite configuration
│   └── TROUBLESHOOTING.md          # Troubleshooting guide
├── Dockerfile                       # Docker image definition
├── docker-compose.yml               # Docker Compose configuration
├── .dockerignore                    # Docker ignore patterns
├── docker_run.sh                    # Docker launcher script
├── run_app.sh                       # Application launcher script
├── install_dependencies_alma.sh     # AlmaLinux system setup script
└── README.md                        # This file
```

## Docker Management

### View logs:
```bash
docker-compose logs -f
# or
docker logs -f cxpm-ai-prd-app
```

### Stop the container:
```bash
docker-compose down
# or
docker stop cxpm-ai-prd-app
```

### Restart the container:
```bash
docker-compose restart
# or
docker restart cxpm-ai-prd-app
```

### Access container shell:
```bash
docker-compose exec cxpm-ai-prd /bin/bash
# or
docker exec -it cxpm-ai-prd-app /bin/bash
```

## Technology Stack

- React 18.3.1
- Vite 6.0.5
- Modern JavaScript (ES modules)
AI Application that supports Product Managers to create PRD
