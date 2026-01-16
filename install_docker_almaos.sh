#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting Docker installation on AlmaLinux..."

# Step 1: Remove old versions if they exist
echo "Removing old Docker versions..."
sudo dnf remove -y docker \
                  docker-client \
                  docker-client-latest \
                  docker-common \
                  docker-latest \
                  docker-latest-logrotate \
                  docker-logrotate \
                  docker-engine

# Step 2: Install dependencies
echo "Installing yum-utils..."
sudo dnf install -y yum-utils

# Step 3: Add the Docker repository
echo "Adding Docker CE repository..."
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Step 4: Install Docker Engine, CLI, and Containerd
echo "Installing Docker Engine..."
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Step 5: Start and enable Docker service
echo "Starting and enabling Docker..."
sudo systemctl start docker
sudo systemctl enable docker

# Step 6: Verify installation
echo "Verifying Docker installation..."
sudo docker --version

echo "Docker installation is complete!"
echo "To run docker without sudo, execute: sudo usermod -aG docker \$USER (then log out and back in)"
