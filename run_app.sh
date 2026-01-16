#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
UI_DIR="$SCRIPT_DIR/ui"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  CXPM AI PRD - Application Launcher${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if ui directory exists
if [ ! -d "$UI_DIR" ]; then
    echo -e "${RED}Error: ui directory not found at $UI_DIR${NC}"
    exit 1
fi

cd "$UI_DIR" || exit 1

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Dependencies not found. Installing...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}Dependencies installed successfully!${NC}\n"
else
    echo -e "${GREEN}Dependencies already installed.${NC}\n"
fi

# Check if application is already running on port 3000
echo -e "${YELLOW}Checking for running instances...${NC}"
PID=$(lsof -ti:3000)

if [ ! -z "$PID" ]; then
    echo -e "${YELLOW}Found running instance(s) on port 3000 (PID: $PID)${NC}"
    echo -e "${YELLOW}Killing existing instance(s)...${NC}"
    kill -9 $PID
    sleep 2
    echo -e "${GREEN}Existing instance(s) terminated.${NC}\n"
else
    echo -e "${GREEN}No running instances found.${NC}\n"
fi

# Start the application
echo -e "${GREEN}Starting the application...${NC}"
echo -e "${GREEN}========================================${NC}\n"

npm run dev
