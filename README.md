# CXPM AI PRD

CX AI Assistant for Product Management — An AI-powered application that helps Product Managers create PRDs.

## Quick Start

### For AlmaLinux Systems

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

### Running the Application (Development)

The easiest way to run the application is using the provided script:

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

---

## Production Deployment

### Prerequisites

- Access to the production VM (AlmaLinux)
- SSH key: `cxpm-ai-prd-key`
- VM IP: `10.226.185.129`

### Step 1: Build the Production Bundle

On your local machine (Windows):

```powershell
cd ui
npm run build
```

This creates optimized static files in `ui/dist/`.

### Step 2: Copy Files to VM

```powershell
scp -i cxpm-ai-prd-key -r ui/dist/* root@10.226.185.129:/var/www/cxpm-ai-prd/
```

### Step 3: Fix Permissions on VM

SSH into the VM:

```powershell
ssh -i cxpm-ai-prd-key root@10.226.185.129
```

Then run:

```bash
# Fix SELinux context
restorecon -Rv /var/www/cxpm-ai-prd

# Ensure proper ownership
chown -R nginx:nginx /var/www/cxpm-ai-prd

# Restart nginx
systemctl restart nginx
```

### Step 4: Verify Deployment

Visit: **http://10.226.185.129**

---

## First-Time VM Setup

If setting up a fresh AlmaLinux VM for the first time:

### 1. Install Nginx

```bash
dnf update -y
dnf install -y epel-release
dnf install -y nginx policycoreutils-python-utils
```

### 2. Create App Directory

```bash
mkdir -p /var/www/cxpm-ai-prd
```

### 3. Configure Nginx

Create `/etc/nginx/conf.d/cxpm-ai-prd.conf`:

```bash
cat > /etc/nginx/conf.d/cxpm-ai-prd.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /var/www/cxpm-ai-prd;
    index index.html;
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF
```

### 4. Configure SELinux

```bash
semanage fcontext -a -t httpd_sys_content_t "/var/www/cxpm-ai-prd(/.*)?"
restorecon -Rv /var/www/cxpm-ai-prd
chown -R nginx:nginx /var/www/cxpm-ai-prd
chmod -R 755 /var/www/cxpm-ai-prd
```

### 5. Start Nginx

```bash
nginx -t
systemctl enable nginx
systemctl start nginx
```

---

## Project Structure

```
cxpm-ai-prd/
├── ui/                              # React application
│   ├── src/                        # Source files
│   │   ├── App.jsx                 # Main component (landing page)
│   │   ├── App.css                 # App styles
│   │   ├── index.css               # Global styles
│   │   └── main.jsx                # Entry point
│   ├── dist/                       # Production build (generated)
│   ├── package.json                # Dependencies
│   └── vite.config.js              # Vite configuration
├── deploy_to_vm.sh                 # Deployment script (bash)
├── run_app.sh                      # Development launcher script
├── install_dependencies_alma.sh    # AlmaLinux system setup script
├── cxpm-ai-prd-key                 # SSH key (git-ignored)
└── README.md                       # This file
```

## Technology Stack

- **Frontend:** React 18.3.1
- **Build Tool:** Vite 6.0.5
- **Web Server:** Nginx
- **Server OS:** AlmaLinux
- **Language:** Modern JavaScript (ES modules)

## Features

- Convert Meeting Notes to Requirements
- Generate PRD (v0)
- Generate Epics & Jira Tickets
- Recommend Features from Feedback
- Generate CX / AI Assistant Mockups
