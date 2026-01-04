# ====================================================================
#  reset-dev.ps1 — Gr8 Result Digital Solutions Dev Reset Tool
# ====================================================================
#  Cleans caches, reinstalls all dependencies, and restarts Next.js
# ====================================================================

Write-Host "Starting full clean rebuild for Funnel Builder..."

# Step 1: Stop Node.js processes
Write-Host "Stopping any running Node.js dev servers..."
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# Step 2: Remove cache folders
Write-Host "Cleaning .next and node_modules folders..."
Remove-Item -Recurse -Force .next, node_modules -ErrorAction SilentlyContinue

# Step 3: Clean npm cache
Write-Host "Cleaning npm cache..."
npm cache clean --force

# Step 4: Reinstall dependencies
Write-Host "Reinstalling dependencies..."
npm install

# Step 5: Start development server
Write-Host "Starting development server..."
npm run dev
