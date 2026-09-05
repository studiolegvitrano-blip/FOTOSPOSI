#!/usr/bin/env bash
# setup-oracle.sh — Setup UNA-TANTUM della VPS Oracle per il sidecar watermark.
# Da eseguire DOPO aver copiato video-watermark-server.js e overlay.js nella
# stessa cartella (vedi README.md "Copiare i file").
#
# Uso (da SSH sulla VPS):
#   # 1) copia i due file .js nella home di ubuntu
#   # 2) chmod +x setup-oracle.sh && sudo ./setup-oracle.sh
#
# Procedura:
#   - installa ffmpeg, node 20 (LTS), sharp
#   - sposta gli script in /opt/fotosposi-vps
#   - genera API key (stampata a schermo, da incollare in Vercel)
#   - crea + avvia il service systemd fotosposi-watermark
#   - mostra lo stato finale e il comando di health check

set -euo pipefail

WORKDIR=/opt/fotosposi-vps
SERVICE=fotosposi-watermark
PORT=8081

echo "==> [1/7] apt update + install ffmpeg + ca-certificates + curl"
sudo apt-get update -y
sudo apt-get install -y ffmpeg ca-certificates curl

echo "==> [2/7] Node.js 20 (LTS) via NodeSource"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d 'v')" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "    node: $(node -v)  npm: $(npm -v)"

echo "==> [3/7] Prepara $WORKDIR"
sudo mkdir -p "$WORKDIR"
sudo chown "$(whoami):$(whoami)" "$WORKDIR"
cd "$WORKDIR"

echo "==> [4/7] Copia gli script (attesi nella home dell'utente corrente)"
cp "$HOME/video-watermark-server.js" "$WORKDIR/" 2>/dev/null || { echo "ERRORE: video-watermark-server.js non trovato in \$HOME. Copialo con scp prima."; exit 1; }
cp "$HOME/overlay.js" "$WORKDIR/" 2>/dev/null || { echo "ERRORE: overlay.js non trovato in \$HOME. Copialo con scp prima."; exit 2; }

echo "==> [5/7] npm install sharp"
if [ ! -f package.json ]; then npm init -y >/dev/null; fi
npm install sharp

echo "==> [6/7] Genera + mostra API key (COPIALA per Vercel VPS_FFMPEG_API_KEY)"
API_KEY=$(openssl rand -hex 32)
echo "    ------------------------------------------------"
echo "    VPS_FFMPEG_API_KEY = $API_KEY"
echo "    ------------------------------------------------"

echo "==> [7/7] systemd service"
sudo tee "/etc/systemd/system/$SERVICE.service" > /dev/null <<EOF
[Unit]
Description=FOTOSPOSI video watermark sidecar
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$WORKDIR
Environment="PORT=$PORT"
Environment="API_KEY=$API_KEY"
ExecStart=/usr/bin/node $WORKDIR/video-watermark-server.js
Restart=on-failure
RestartSec=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE"
sudo systemctl restart "$SERVICE"

echo
echo "✅ Setup completato."
echo "   API key (salvala ora, non verrà più stampata): $API_KEY"
echo "   Stato: run 'sudo systemctl status $SERVICE'"
echo "   Log:   run 'sudo journalctl -u $SERVICE -f'"
echo "   Health: curl http://127.0.0.1:$PORT/health"