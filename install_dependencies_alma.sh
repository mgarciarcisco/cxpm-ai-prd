#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  CXPM AI PRD - AlmaLinux Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run this script with sudo or as root${NC}"
    echo -e "${YELLOW}Usage: sudo ./install_dependencies_alma.sh${NC}"
    exit 1
fi

echo -e "${GREEN}Starting dependency installation for AlmaLinux...${NC}\n"

# Update system packages
echo -e "${YELLOW}[1/6] Updating system packages...${NC}"
dnf update -y
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ System packages updated${NC}\n"
else
    echo -e "${RED}✗ Failed to update system packages${NC}"
    exit 1
fi

# Install EPEL repository (Extra Packages for Enterprise Linux)
echo -e "${YELLOW}[2/6] Installing EPEL repository...${NC}"
dnf install -y epel-release
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ EPEL repository installed${NC}\n"
else
    echo -e "${RED}✗ Failed to install EPEL repository${NC}"
    exit 1
fi

# Install development tools and utilities
echo -e "${YELLOW}[3/6] Installing development tools...${NC}"
dnf groupinstall -y "Development Tools"
dnf install -y gcc-c++ make git curl wget lsof
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Development tools installed${NC}\n"
else
    echo -e "${RED}✗ Failed to install development tools${NC}"
    exit 1
fi

# Check if Node.js is already installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${YELLOW}Node.js is already installed: $NODE_VERSION${NC}"
    echo -e "${YELLOW}Checking if version is >= 18...${NC}"
    
    NODE_MAJOR_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}Node.js version is too old. Installing Node.js 20...${NC}"
        INSTALL_NODE=true
    else
        echo -e "${GREEN}✓ Node.js version is sufficient${NC}\n"
        INSTALL_NODE=false
    fi
else
    echo -e "${YELLOW}Node.js not found. Installing Node.js 20...${NC}"
    INSTALL_NODE=true
fi

# Install Node.js 20 LTS using NodeSource repository
if [ "$INSTALL_NODE" = true ]; then
    echo -e "${YELLOW}[4/6] Installing Node.js 20 LTS...${NC}"
    
    # Download and run NodeSource setup script
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    
    # Install Node.js
    dnf install -y nodejs
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Node.js installed successfully${NC}\n"
    else
        echo -e "${RED}✗ Failed to install Node.js${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}[4/6] Skipping Node.js installation (already installed)${NC}\n"
fi

# Verify installations
echo -e "${YELLOW}[5/6] Verifying installations...${NC}"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js: $NODE_VERSION${NC}"
else
    echo -e "${RED}✗ Node.js not found${NC}"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ npm: v$NPM_VERSION${NC}"
else
    echo -e "${RED}✗ npm not found${NC}"
    exit 1
fi

# Check git
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version | cut -d' ' -f3)
    echo -e "${GREEN}✓ git: v$GIT_VERSION${NC}"
else
    echo -e "${RED}✗ git not found${NC}"
fi

# Check lsof
if command -v lsof &> /dev/null; then
    echo -e "${GREEN}✓ lsof: installed${NC}"
else
    echo -e "${RED}✗ lsof not found${NC}"
fi

echo ""

# Configure npm global directory for non-root users (optional but recommended)
echo -e "${YELLOW}[6/6] Configuring npm for non-root users...${NC}"
if [ ! -z "$SUDO_USER" ]; then
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    NPM_DIR="$USER_HOME/.npm-global"
    
    # Create directory if it doesn't exist
    if [ ! -d "$NPM_DIR" ]; then
        sudo -u "$SUDO_USER" mkdir -p "$NPM_DIR"
        sudo -u "$SUDO_USER" npm config set prefix "$NPM_DIR"
        echo -e "${GREEN}✓ npm configured for user $SUDO_USER${NC}"
        echo -e "${YELLOW}Note: Add this line to $USER_HOME/.bashrc or $USER_HOME/.bash_profile:${NC}"
        echo -e "${BLUE}export PATH=~/.npm-global/bin:\$PATH${NC}\n"
    else
        echo -e "${GREEN}✓ npm already configured${NC}\n"
    fi
else
    echo -e "${YELLOW}Running as root directly, skipping npm user configuration${NC}\n"
fi

# Final summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Installation Complete!${NC}"
echo -e "${GREEN}========================================${NC}\n"

echo -e "${BLUE}Installed versions:${NC}"
echo -e "  Node.js: $(node -v)"
echo -e "  npm: v$(npm -v)"
echo -e "  git: v$(git --version | cut -d' ' -f3)"

echo -e "\n${GREEN}You can now run the application with:${NC}"
echo -e "${YELLOW}  ./run_app.sh${NC}\n"

echo -e "${BLUE}Note: If this is a fresh AlmaLinux installation, you may need to${NC}"
echo -e "${BLUE}configure the firewall to allow access to port 3000:${NC}"
echo -e "${YELLOW}  sudo firewall-cmd --permanent --add-port=3000/tcp${NC}"
echo -e "${YELLOW}  sudo firewall-cmd --reload${NC}\n"
