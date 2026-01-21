#!/bin/bash

# Deployment script for CX AI Assistant to AlmaLinux VM
# This script deploys the built React app to the VM and configures nginx

set -e

# Configuration
VM_HOST="root@10.226.185.129"
SSH_KEY="../cxpm-ai-prd-key"
APP_DIR="/var/www/cxpm-ai-prd"
DIST_DIR="ui/dist"

echo "=========================================="
echo "CX AI Assistant - VM Deployment Script"
echo "=========================================="

# Check if dist folder exists
if [ ! -d "$DIST_DIR" ]; then
    echo "Error: Build directory '$DIST_DIR' not found."
    echo "Please run 'cd ui && npm run build' first."
    exit 1
fi

echo ""
echo "[1/5] Connecting to VM and installing dependencies..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VM_HOST" << 'ENDSSH'
    # Update system
    dnf update -y
    
    # Install EPEL repository
    dnf install -y epel-release
    
    # Install nginx
    dnf install -y nginx
    
    # Create app directory
    mkdir -p /var/www/cxpm-ai-prd
    
    echo "Dependencies installed successfully!"
ENDSSH

echo ""
echo "[2/5] Copying built files to VM..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -r $DIST_DIR/* "$VM_HOST:$APP_DIR/"

echo ""
echo "[3/5] Configuring nginx..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VM_HOST" << 'ENDSSH'
    # Create nginx configuration
    cat > /etc/nginx/conf.d/cxpm-ai-prd.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /var/www/cxpm-ai-prd;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Handle React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

    # Remove default nginx config if it conflicts
    if [ -f /etc/nginx/nginx.conf ]; then
        # Comment out default server block in main config
        sed -i 's/^\s*server {/#server {/' /etc/nginx/nginx.conf 2>/dev/null || true
    fi
    
    echo "Nginx configured!"
ENDSSH

echo ""
echo "[4/5] Setting permissions and SELinux context..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VM_HOST" << 'ENDSSH'
    # Set proper ownership
    chown -R nginx:nginx /var/www/cxpm-ai-prd
    
    # Set SELinux context (required for AlmaLinux)
    semanage fcontext -a -t httpd_sys_content_t "/var/www/cxpm-ai-prd(/.*)?" 2>/dev/null || true
    restorecon -Rv /var/www/cxpm-ai-prd
    
    # Allow nginx to connect (if needed)
    setsebool -P httpd_can_network_connect 1 2>/dev/null || true
    
    echo "Permissions set!"
ENDSSH

echo ""
echo "[5/5] Starting nginx..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VM_HOST" << 'ENDSSH'
    # Test nginx configuration
    nginx -t
    
    # Enable and start nginx
    systemctl enable nginx
    systemctl restart nginx
    
    # Configure firewall
    firewall-cmd --permanent --add-service=http 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    
    echo "Nginx started!"
ENDSSH

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Your app is now available at: http://10.226.185.129"
echo ""
