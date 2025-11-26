#!/usr/bin/env bash
# Setup script for BreakerBot
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
OPENAI_API_KEY=
XAI_API_KEY=
GENIUS_API_KEY=
# Comma-separated list of WhatsApp numbers without spaces
ADMINS=
EOE
  fi
  cp .env.example .env
  echo "Created default .env file. Edit it with your API keys and admin numbers." 
fi

cat <<'EOM'
Setup complete!
Run 'npm start' to authenticate the bot.
After authentication, use 'npm run server' to run BreakerBot with pm2.
EOM
