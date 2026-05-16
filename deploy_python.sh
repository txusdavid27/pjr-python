#!/bin/bash

# Configuration
REMOTE_USER="admin"
REMOTE_HOST="192.168.0.143"
REMOTE_DIR="/media/admin/MAXELL8GB/pjr-app-python"

echo "🚀 Deploying Python Backend to $REMOTE_HOST..."

# Ensure target directory exists
ssh $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_DIR"

echo "📦 Syncing backend files..."
# Sync .env first (important for credentials)
scp .env $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/.env

# Sync project files
rsync -avz --progress \
  --exclude '.git' \
  --exclude 'venv' \
  --exclude '__pycache__' \
  --exclude 'photos' \
  --exclude 'cache.json' \
  --exclude 'frontend/node_modules' \
  ./ $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "✅ Files synced! Running remote setup..."
ssh $REMOTE_USER@$REMOTE_HOST "cd $REMOTE_DIR && bash setup_python_service.sh"

echo "🎉 Python Service Deployed!"
