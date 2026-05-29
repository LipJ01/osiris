#!/bin/sh
set -eu

cd /Users/jack/lab/osiris

export NODE_ENV=production
export NEXT_TELEMETRY_DISABLED=1
export HOSTNAME=0.0.0.0
export PORT=3016

if [ ! -d .next ]; then
  npm run build
fi

exec npm run start -- --hostname 0.0.0.0 --port 3016
