#!/usr/bin/env bash
# Setup script for ViewOnceBot
set -e

# Check prerequisites
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Please install Node.js >=16 and rerun this script." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Please install npm and rerun this script." >&2
  exit 1
fi

# Install pm2 globally if not present
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing pm2 globally..."
  npm install -g pm2
fi

# Install project dependencies
echo "Installing dependencies..."
npm install

# Provide environment file
if [ ! -f .env ]; then
  if [ ! -f .env.example ]; then
    cat <<'EOE' > .env.example
# Copy this file to '.env' and fill in your credentials
# Número que receberá as mídias viewOnce (apenas dígitos, ex: 5511999999999)
VIEWONCE_DM_NUMBER=
EOE
  fi
  cp .env.example .env
  echo "Created default .env file. Edit VIEWONCE_DM_NUMBER with the number that will receive viewOnce media." 
fi

cat <<'EOM'
Setup complete!
Run 'npm start' to authenticate the bot.
After authentication, use 'npm run server' to run ViewOnceBot with pm2.
EOM
