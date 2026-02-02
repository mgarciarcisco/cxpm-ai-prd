# CXPM AI PRD - Development Server Startup Script
# This script starts the application using Docker

param(
    [switch]$Stop,
    [switch]$Restart,
    [switch]$Logs,
    [switch]$Build
)

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  CXPM AI PRD - Docker Development   " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check Docker is available
$dockerVersion = docker --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "`nERROR: Docker is not installed or not running." -ForegroundColor Red
    Write-Host "Please install Docker Desktop from: https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}

Write-Host "`nDocker: $dockerVersion" -ForegroundColor Gray

Push-Location $ProjectRoot

if ($Stop) {
    Write-Host "`nStopping containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml down
    Write-Host "Containers stopped." -ForegroundColor Green
}
elseif ($Restart) {
    Write-Host "`nRestarting containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml restart
    Write-Host "Containers restarted." -ForegroundColor Green
    Write-Host "`nFrontend: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
}
elseif ($Logs) {
    Write-Host "`nShowing logs (Ctrl+C to exit)..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml logs -f
}
elseif ($Build) {
    Write-Host "`nRebuilding and starting containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml up --build -d
    Write-Host "`nContainers started." -ForegroundColor Green
    Write-Host "`nFrontend: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
    Write-Host "`nRun '.\start_dev.ps1 -Logs' to view logs" -ForegroundColor Gray
}
else {
    # Default: start containers
    Write-Host "`nStarting containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.dev.yml up -d
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nContainers started successfully!" -ForegroundColor Green
        Write-Host "`nFrontend: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "Backend:  http://localhost:8000" -ForegroundColor Cyan
        Write-Host "`nCommands:" -ForegroundColor Gray
        Write-Host "  .\start_dev.ps1 -Logs     View logs" -ForegroundColor Gray
        Write-Host "  .\start_dev.ps1 -Stop     Stop containers" -ForegroundColor Gray
        Write-Host "  .\start_dev.ps1 -Restart  Restart containers" -ForegroundColor Gray
        Write-Host "  .\start_dev.ps1 -Build    Rebuild and start" -ForegroundColor Gray
    }
    else {
        Write-Host "`nFailed to start containers. Run with -Build to rebuild." -ForegroundColor Red
    }
}

Pop-Location
