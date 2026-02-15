# CXPM AI PRD - UI

React + Vite frontend for the CXPM AI PRD application.

## Prerequisites

- Node.js 18+
- npm

## Commands

```bash
cd ui
npm install
npm run dev
```

Additional scripts:

```bash
npm run build
npm run preview
npm run lint
npm run test
npm run test:e2e
```

## Runtime

- Dev server: `http://localhost:3000`
- API base URL is configured via `VITE_API_URL` (Docker dev uses `http://localhost:8000`)

## Testing

- Unit tests: Vitest (`ui/tests`)
- E2E tests: Playwright (`ui/tests/e2e`, configured by `ui/playwright.config.ts`)

For full project setup (backend + Docker), use the root `README.md`.
