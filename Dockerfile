FROM almalinux:9

# Set environment variables
ENV NODE_VERSION=v24.11.1 \
    NPM_VERSION=11.6.2 \
    NVM_DIR=/root/.nvm \
    NODE_PATH=/usr/local/bin

# Install system dependencies
RUN dnf update -y && \
    dnf install -y epel-release && \
    dnf groupinstall -y "Development Tools" && \
    dnf remove -y curl-minimal && \
    dnf install -y \
    gcc-c++ \
    make \
    git \
    curl \
    wget \
    lsof \
    && dnf clean all

# Install nvm and Node.js
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash && \
    . $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm use $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    npm install -g npm@$NPM_VERSION

# Create symlinks for system-wide access
RUN ln -sf $NVM_DIR/versions/node/$NODE_VERSION/bin/node /usr/local/bin/node && \
    ln -sf $NVM_DIR/versions/node/$NODE_VERSION/bin/npm /usr/local/bin/npm && \
    ln -sf $NVM_DIR/versions/node/$NODE_VERSION/bin/npx /usr/local/bin/npx

# Verify installations
RUN node --version && npm --version

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY ui/package*.json ./ui/

# Install dependencies
WORKDIR /app/ui
RUN . $NVM_DIR/nvm.sh && npm install

# Copy the rest of the application
WORKDIR /app
COPY ui/ ./ui/

# Expose port
EXPOSE 3000

# Set working directory to ui
WORKDIR /app/ui

# Start the application
CMD ["/bin/bash", "-c", "source $NVM_DIR/nvm.sh && npm run dev -- --host 0.0.0.0"]
