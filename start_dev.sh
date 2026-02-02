#!/bin/bash
# CXPM AI PRD - Development Server Startup Script
# This script starts the application using Docker

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================"
echo "  CXPM AI PRD - Docker Development   "
echo "======================================"

# Check Docker is available
if ! command -v docker &> /dev/null; then
    echo ""
    echo "ERROR: Docker is not installed or not running."
    echo "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

echo ""
echo "Docker: $(docker --version)"

case "${1:-start}" in
    stop)
        echo ""
        echo "Stopping containers..."
        docker-compose -f docker-compose.dev.yml down
        echo "Containers stopped."
        ;;
    restart)
        echo ""
        echo "Restarting containers..."
        docker-compose -f docker-compose.dev.yml restart
        echo "Containers restarted."
        echo ""
        echo "Frontend: http://localhost:3000"
        echo "Backend:  http://localhost:8000"
        ;;
    logs)
        echo ""
        echo "Showing logs (Ctrl+C to exit)..."
        docker-compose -f docker-compose.dev.yml logs -f
        ;;
    build)
        echo ""
        echo "Rebuilding and starting containers..."
        docker-compose -f docker-compose.dev.yml up --build -d
        echo ""
        echo "Containers started."
        echo ""
        echo "Frontend: http://localhost:3000"
        echo "Backend:  http://localhost:8000"
        echo ""
        echo "Run './start_dev.sh logs' to view logs"
        ;;
    start|"")
        echo ""
        echo "Starting containers..."
        docker-compose -f docker-compose.dev.yml up -d
        
        if [ $? -eq 0 ]; then
            echo ""
            echo "Containers started successfully!"
            echo ""
            echo "Frontend: http://localhost:3000"
            echo "Backend:  http://localhost:8000"
            echo ""
            echo "Commands:"
            echo "  ./start_dev.sh logs     View logs"
            echo "  ./start_dev.sh stop     Stop containers"
            echo "  ./start_dev.sh restart  Restart containers"
            echo "  ./start_dev.sh build    Rebuild and start"
        else
            echo ""
            echo "Failed to start containers. Run './start_dev.sh build' to rebuild."
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|build}"
        exit 1
        ;;
esac
