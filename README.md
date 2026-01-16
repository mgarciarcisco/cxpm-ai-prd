# CXPM AI PRD

A web application built with React 18 and Vite.

## Quick Start

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

## Project Structure

```
cxpm-ai-prd/
├── ui/                  # React application
│   ├── src/            # Source files
│   ├── package.json    # Dependencies
│   └── vite.config.js  # Vite configuration
├── run_app.sh          # Application launcher script
└── README.md           # This file
```

## Technology Stack

- React 18.3.1
- Vite 6.0.5
- Modern JavaScript (ES modules)
AI Application that supports Product Managers to create PRD
