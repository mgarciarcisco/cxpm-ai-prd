#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CXPM AI PRD - Docker Launcher${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo -e "${YELLOW}Please install Docker first: https://docs.docker.com/engine/install/${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    echo -e "${YELLOW}Please start Docker first${NC}"
    exit 1
fi

echo -e "${GREEN}Docker is available and running${NC}\n"

# Check for running containers
CONTAINER_NAME="cxpm-ai-prd-app"
RUNNING_CONTAINER=$(docker ps -q -f name=$CONTAINER_NAME)

if [ ! -z "$RUNNING_CONTAINER" ]; then
    echo -e "${YELLOW}Found running container: $CONTAINER_NAME${NC}"
    echo -e "${YELLOW}Stopping and removing existing container...${NC}"
    docker stop $CONTAINER_NAME
    docker rm $CONTAINER_NAME
    echo -e "${GREEN}Existing container removed${NC}\n"
fi

# Check if docker-compose is available
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null 2>&1; then
    echo -e "${GREEN}Using Docker Compose...${NC}\n"
    
    # Use docker-compose or docker compose depending on what's available
    if command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
    
    # Stop any running services
    $COMPOSE_CMD down
    
    # Build and start
    echo -e "${YELLOW}Building and starting container...${NC}"
    $COMPOSE_CMD up --build -d
    
    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}  Container started successfully!${NC}"
        echo -e "${GREEN}========================================${NC}\n"
        echo -e "${BLUE}Application is running at: ${GREEN}http://localhost:3000${NC}\n"
        echo -e "${YELLOW}Useful commands:${NC}"
        echo -e "  View logs:        ${BLUE}$COMPOSE_CMD logs -f${NC}"
        echo -e "  Stop container:   ${BLUE}$COMPOSE_CMD down${NC}"
        echo -e "  Restart:          ${BLUE}$COMPOSE_CMD restart${NC}"
        echo -e "  Shell access:     ${BLUE}$COMPOSE_CMD exec cxpm-ai-prd /bin/bash${NC}\n"
    else
        echo -e "${RED}Failed to start container${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Docker Compose not found, using docker run...${NC}\n"
    
    # Build the image
    echo -e "${YELLOW}Building Docker image...${NC}"
    docker build -t cxpm-ai-prd .
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to build Docker image${NC}"
        exit 1
    fi
    
    # Run the container
    echo -e "${YELLOW}Starting container...${NC}"
    docker run -d \
        --name $CONTAINER_NAME \
        -p 3000:3000 \
        -v "$(pwd)/ui/src:/app/ui/src" \
        -v "$(pwd)/ui/public:/app/ui/public" \
        cxpm-ai-prd
    
    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}========================================${NC}"
        echo -e "${GREEN}  Container started successfully!${NC}"
        echo -e "${GREEN}========================================${NC}\n"
        echo -e "${BLUE}Application is running at: ${GREEN}http://localhost:3000${NC}\n"
        echo -e "${YELLOW}Useful commands:${NC}"
        echo -e "  View logs:        ${BLUE}docker logs -f $CONTAINER_NAME${NC}"
        echo -e "  Stop container:   ${BLUE}docker stop $CONTAINER_NAME${NC}"
        echo -e "  Start container:  ${BLUE}docker start $CONTAINER_NAME${NC}"
        echo -e "  Remove container: ${BLUE}docker rm -f $CONTAINER_NAME${NC}"
        echo -e "  Shell access:     ${BLUE}docker exec -it $CONTAINER_NAME /bin/bash${NC}\n"
    else
        echo -e "${RED}Failed to start container${NC}"
        exit 1
    fi
fi
