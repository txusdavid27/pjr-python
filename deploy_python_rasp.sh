#!/bin/bash

# ============================================================
# deploy_pi.sh — PJR Python App Deploy
# Ejecutar desde la raíz del proyecto clonado en la Pi
# Uso: bash deploy_pi.sh
# ============================================================

set -e  # Detener si algo falla

REMOTE_USER="admin"
VENV_DIR="/home/$REMOTE_USER/pjr-venv"
APP_DIR="/media/admin/MAXELL8GB/pjr-app-python"
TUNNEL_ID="936c4bf0-0380-4766-8dd7-2b39165727ea"
SERVICE_SUBDOMAIN="pjr-app-data.online"
PORT=5002

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   🚀 PJR APP — Deploy en Raspberry Pi    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ------------------------------------------------------------
# 1. Verificar que estamos en el directorio correcto
# ------------------------------------------------------------
if [ ! -f "app.py" ]; then
  echo "❌ Error: No se encontró app.py"
  echo "   Asegúrate de correr este script desde la carpeta del proyecto."
  exit 1
fi

echo "📁 Directorio del proyecto: $(pwd)"

# ------------------------------------------------------------
# 2. Python — Entorno virtual y dependencias
# ------------------------------------------------------------
echo ""
echo "🐍 Configurando entorno virtual Python..."
sudo apt-get install -y python3-venv python3-pip --quiet

if [ ! -d "$VENV_DIR" ]; then
  echo "   Creando venv en $VENV_DIR..."
  python3 -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"
echo "   Instalando dependencias..."
pip install -q -r requirements.txt
echo "✅ Dependencias instaladas"

# ------------------------------------------------------------
# 3. PM2 — Levantar / recargar el servicio
# ------------------------------------------------------------
echo ""
echo "⚙️  Configurando PM2..."

# Verificar que ecosystem.config.js existe
if [ ! -f "ecosystem.config.js" ]; then
  echo "❌ Error: No se encontró ecosystem.config.js"
  exit 1
fi

# Si el proceso ya existe lo recarga, si no lo inicia
if pm2 list | grep -q "pjr-api-python"; then
  echo "   Recargando proceso existente..."
  pm2 reload pjr-api-python
else
  echo "   Iniciando proceso nuevo..."
  pm2 start ecosystem.config.js
fi

# Limpiar proceso de sync si quedó de versión anterior
pm2 delete pjr-data-sync 2>/dev/null || true

pm2 save --force
echo "✅ PM2 configurado"

# ------------------------------------------------------------
# 4. PM2 Startup — Asegurar arranque automático tras reboot
# ------------------------------------------------------------
echo ""
echo "🔒 Verificando PM2 startup hook..."
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd \
  -u "$REMOTE_USER" --hp "/home/$REMOTE_USER" 2>/dev/null || true
pm2 save --force
echo "✅ Startup hook activo"

# ------------------------------------------------------------
# 5. Cloudflare Tunnel — Actualizar config y reiniciar
# ------------------------------------------------------------
echo ""
echo "☁️  Actualizando Cloudflare Tunnel..."

sudo tee /etc/cloudflared/config.yml > /dev/null <<EOT
tunnel: $TUNNEL_ID
credentials-file: /home/$REMOTE_USER/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $SERVICE_SUBDOMAIN
    service: http://localhost:$PORT
  - service: http_status:404
EOT

sudo systemctl restart cloudflared
echo "✅ Cloudflare Tunnel reiniciado → $SERVICE_SUBDOMAIN"

# ------------------------------------------------------------
# 6. Health check
# ------------------------------------------------------------
echo ""
echo "🏥 Verificando servicio local..."
sleep 3

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/api/players 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
  echo "✅ Servicio respondiendo (HTTP $HTTP_CODE)"
else
  echo "⚠️  Servicio no responde aún (HTTP $HTTP_CODE)"
  echo "   Revisa los logs con: pm2 logs pjr-api-python"
fi

# ------------------------------------------------------------
# Resumen final
# ------------------------------------------------------------
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║           🎉 Deploy Completado           ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Local:   http://localhost:$PORT          ║"
echo "║  Público: https://$SERVICE_SUBDOMAIN  ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  📋 Comandos útiles:"
echo "     pm2 logs pjr-api-python     — ver logs en vivo"
echo "     pm2 status                  — estado del proceso"
echo "     sudo systemctl status cloudflared  — estado del tunnel"
echo ""
