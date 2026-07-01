#!/usr/bin/env bash
# One-click startup for Replit.
# 1) installs deps, 2) pushes DB schema, 3) builds, 4) starts the server.
set -e

echo "🎭 Mafia: The City — starting up on Replit…"

if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  DATABASE_URL is not set!"
  echo "   Open the 🔒 Secrets tool and add DATABASE_URL (your Neon connection string)."
  echo "   Example: postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require"
  exit 1
fi

# Install dependencies if needed
if [ ! -d node_modules ]; then
  echo "📦 Installing dependencies…"
  npm install
fi

# Create/update database tables
echo "🗄️  Applying database schema…"
npx drizzle-kit push || echo "⚠️  drizzle push skipped/failed — continuing."

# Build if there's no production build yet
if [ ! -d .next ]; then
  echo "🔨 Building the app…"
  npm run build
fi

echo "🚀 Launching server on port ${PORT:-3000}…"
npm run start -- -H 0.0.0.0 -p "${PORT:-3000}"
