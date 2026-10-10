#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
node_modules/.bin/prisma migrate deploy

# The singleton SiteSettings row is created lazily by getSettings()'s upsert
# on first access, so no explicit seed step is needed here.

echo "[entrypoint] starting server..."
exec node server.js
