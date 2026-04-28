#!/bin/sh
set -e
chown -R node:node /app/logs /app/credentials /app/instances /app/maps /app/authtokens 2>/dev/null || true
exec gosu node node dist/index.js
