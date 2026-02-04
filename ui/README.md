# CX AIA for Product Manager - UI

A modern React web application built with React 18 and Vite.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Navigate to the ui folder:
```bash
cd ui
```

2. Install dependencies:
```bash
npm install
```

### Development

Run the development server:
```bash
npm run dev
```

The app will automatically open in your browser at `http://localhost:3000`

### Build

Build the app for production:
```bash
npm run build
```

The optimized production build will be created in the `dist` folder.

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```

## Project Structure

```
ui/
├── src/
│   ├── App.jsx          # Main application component
│   ├── App.css          # App component styles
│   ├── main.jsx         # Application entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## Technology Stack

- **React 18.3.1** - Latest stable version of React
- **Vite 6.0.5** - Fast build tool and development server
- **Modern JavaScript** - ES modules and latest JavaScript features
- **Node.js v24.11.1** - Configured with compatibility polyfills

## Troubleshooting

If you encounter any issues (especially with Node.js v24), see the [TROUBLESHOOTING.md](TROUBLESHOOTING.md) guide.

Common fixes:
```bash
# Clean install after updates
cd ui
rm -rf node_modules package-lock.json
npm install
```
