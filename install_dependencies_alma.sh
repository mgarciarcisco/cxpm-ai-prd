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

# Define target versions
TARGET_NODE_VERSION="v24.11.1"
TARGET_NPM_VERSION="11.6.2"

# Check if Node.js is already installed with correct version
if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node -v)
    echo -e "${YELLOW}Node.js is already installed: $CURRENT_NODE_VERSION${NC}"
    
    if [ "$CURRENT_NODE_VERSION" = "$TARGET_NODE_VERSION" ]; then
        echo -e "${GREEN}✓ Node.js version matches target version${NC}\n"
        INSTALL_NODE=false
    else
        echo -e "${YELLOW}Node.js version differs from target ($TARGET_NODE_VERSION). Will install target version...${NC}"
        INSTALL_NODE=true
    fi
else
    echo -e "${YELLOW}Node.js not found. Installing Node.js $TARGET_NODE_VERSION...${NC}"
    INSTALL_NODE=true
fi

# Install Node.js v24.11.1 using nvm
if [ "$INSTALL_NODE" = true ]; then
    echo -e "${YELLOW}[4/6] Installing Node.js $TARGET_NODE_VERSION using nvm...${NC}"
    
    # Determine the user to install nvm for
    if [ ! -z "$SUDO_USER" ]; then
        INSTALL_USER="$SUDO_USER"
        USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    else
        INSTALL_USER="root"
        USER_HOME="/root"
    fi
    
    # Install nvm
    echo -e "${YELLOW}Installing nvm (Node Version Manager)...${NC}"
    sudo -u "$INSTALL_USER" bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to install nvm${NC}"
        exit 1
    fi
    
    # Load nvm
    export NVM_DIR="$USER_HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    # Install specific Node.js version
    echo -e "${YELLOW}Installing Node.js $TARGET_NODE_VERSION...${NC}"
    sudo -u "$INSTALL_USER" bash -c "source $NVM_DIR/nvm.sh && nvm install $TARGET_NODE_VERSION && nvm use $TARGET_NODE_VERSION && nvm alias default $TARGET_NODE_VERSION"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗ Failed to install Node.js $TARGET_NODE_VERSION${NC}"
        exit 1
    fi
    
    # Create symlinks for system-wide access
    ln -sf "$NVM_DIR/versions/node/$TARGET_NODE_VERSION/bin/node" /usr/local/bin/node
    ln -sf "$NVM_DIR/versions/node/$TARGET_NODE_VERSION/bin/npm" /usr/local/bin/npm
    ln -sf "$NVM_DIR/versions/node/$TARGET_NODE_VERSION/bin/npx" /usr/local/bin/npx
    
    echo -e "${GREEN}✓ Node.js $TARGET_NODE_VERSION installed successfully${NC}\n"
else
    echo -e "${YELLOW}[4/6] Skipping Node.js installation (correct version already installed)${NC}\n"
fi

# Install specific npm version
echo -e "${YELLOW}[4.5/6] Installing npm $TARGET_NPM_VERSION...${NC}"

# Load nvm if available
if [ -f "$USER_HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$USER_HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Check current npm version
if command -v npm &> /dev/null; then
    CURRENT_NPM_VERSION=$(npm -v)
    echo -e "${YELLOW}Current npm version: v$CURRENT_NPM_VERSION${NC}"
    
    if [ "$CURRENT_NPM_VERSION" = "$TARGET_NPM_VERSION" ]; then
        echo -e "${GREEN}✓ npm version matches target version${NC}\n"
    else
        echo -e "${YELLOW}Updating npm to $TARGET_NPM_VERSION...${NC}"
        if [ ! -z "$SUDO_USER" ]; then
            sudo -u "$SUDO_USER" bash -c "source $NVM_DIR/nvm.sh 2>/dev/null; npm install -g npm@$TARGET_NPM_VERSION"
        else
            npm install -g npm@$TARGET_NPM_VERSION
        fi
        
        if [ $? -eq 0 ]; then
            # Update symlink
            ln -sf "$NVM_DIR/versions/node/$TARGET_NODE_VERSION/bin/npm" /usr/local/bin/npm
            echo -e "${GREEN}✓ npm updated to $TARGET_NPM_VERSION${NC}\n"
        else
            echo -e "${RED}✗ Failed to update npm${NC}"
            exit 1
        fi
    fi
else
    echo -e "${RED}✗ npm not found after Node.js installation${NC}"
    exit 1
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

# Configure environment for non-root users
echo -e "${YELLOW}[6/6] Configuring environment...${NC}"
if [ ! -z "$SUDO_USER" ]; then
    USER_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
    
    # Add nvm configuration to user's shell profile if not already present
    for PROFILE_FILE in "$USER_HOME/.bashrc" "$USER_HOME/.bash_profile"; do
        if [ -f "$PROFILE_FILE" ]; then
            if ! grep -q 'NVM_DIR' "$PROFILE_FILE"; then
                echo -e "\n# nvm configuration" >> "$PROFILE_FILE"
                echo 'export NVM_DIR="$HOME/.nvm"' >> "$PROFILE_FILE"
                echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> "$PROFILE_FILE"
                echo '[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"' >> "$PROFILE_FILE"
                chown "$SUDO_USER:$SUDO_USER" "$PROFILE_FILE"
            fi
        fi
    done
    
    echo -e "${GREEN}✓ Environment configured for user $SUDO_USER${NC}\n"
else
    echo -e "${YELLOW}Running as root directly, skipping user configuration${NC}\n"
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
