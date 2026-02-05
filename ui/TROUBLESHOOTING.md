# Troubleshooting Guide

## Node.js v24 Compatibility Issues

### Error: `crypto$2.getRandomValues is not a function`

**Cause**: This error occurs with Node.js v24 due to changes in how the crypto module handles browser-compatible APIs in Vite/Rollup.

**Solution**: The project has been configured to handle this automatically with:

1. **crypto-browserify polyfill** - Added to dependencies
2. **Vite configuration updates** - Aliases and global definitions
3. **Rollup override** - Ensures compatible version

**After pulling these changes, run:**

```bash
cd ui
rm -rf node_modules package-lock.json
npm install
npm run dev
```

This will:
- Clean old dependencies
- Install the crypto-browserify polyfill
- Reinstall with updated configuration

### If the error persists:

1. **Verify Node.js version:**
   ```bash
   node -v  # Should show v24.11.1
   npm -v   # Should show 11.6.2
   ```

2. **Clear Vite cache:**
   ```bash
   cd ui
   rm -rf node_modules/.vite
   npm run dev
   ```

3. **Check for conflicting global packages:**
   ```bash
   npm list -g --depth=0
   ```

## Other Common Issues

### Port 3000 Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:

```bash
# Find process using port 3000
lsof -ti:3000

# Kill the process
kill -9 $(lsof -ti:3000)
```

### Permission Denied Errors

**Error**: `EACCES: permission denied`

**Solution**: Ensure proper ownership of project files:

```bash
# If installed with sudo, fix ownership
sudo chown -R $USER:$USER /path/to/cxpm-ai-prd
```

### npm Installation Fails

**Error**: Various npm install errors

**Solution**:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and lockfile
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

## Getting Help

If you encounter other issues:

1. Check the error message carefully
2. Verify all dependencies are installed: `npm list`
3. Ensure you're using the correct Node.js and npm versions
4. Try running with verbose logging: `npm run dev --verbose`
