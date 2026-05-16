#!/bin/bash

REMOTE_USER="admin"
SERVICE_SUBDOMAIN="pjr-app-data.online"
TUNNEL_ID="936c4bf0-0380-4766-8dd7-2b39165727ea"

echo "🔄 Configuring remote Python service..."

# 1. Python Environment
echo "🐍 Setting up Python Virtual Environment..."
# Ensure python3-venv is installed (Debian/Raspbian specific)
sudo apt-get install -y python3-venv python3-pip

VENV_DIR="/home/$REMOTE_USER/pjr-venv"
if [ ! -d "$VENV_DIR" ]; then
    python3 -m venv $VENV_DIR
fi
source $VENV_DIR/bin/activate
pip install -r requirements.txt

# 2. Start PM2 Service
echo "🚀 Starting PM2 Service with Gunicorn..."
# We use PM2 to manage gunicorn processes mapped in ecosystem.config.js
pm2 start ecosystem.config.js
pm2 reload pjr-api-python
pm2 delete pjr-data-sync || true
pm2 save

# Enable PM2 Startup Hook if not already present
echo "🔒 Enabling PM2 Startup Hook..."
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $REMOTE_USER --hp /home/$REMOTE_USER
pm2 save --force

# 3. Update Cloudflare Tunnel Config
echo "📝 Updating Cloudflare Tunnel Config (Port 5002 as main API)..."

sudo tee /etc/cloudflared/config.yml > /dev/null <<EOT
tunnel: $TUNNEL_ID
credentials-file: /home/$REMOTE_USER/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SERVICE_SUBDOMAIN
    service: http://localhost:5002
  - service: http_status:404
EOT

echo "🔄 Restarting cloudflared..."
sudo systemctl restart cloudflared

echo "🏥 Checking Local Service Health..."
sleep 2
curl -v http://localhost:5002/api/players || echo "⚠️ Local Health Check Failed!"

echo "✅ Setup Complete!"
