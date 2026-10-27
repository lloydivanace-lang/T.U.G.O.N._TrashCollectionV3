#!/bin/bash
# =========================================================================
# T.U.G.O.N. - Barangay 40 (Gumamela) & 41 (Rosal), Cavite City
# Raspberry Pi 4B Automated Boot / Brownout Recovery Setup (systemd)
# =========================================================================

set -e

echo "=========================================================="
echo "  T.U.G.O.N. AUTOSTART SETUP PARA SA RASPBERRY PI 4B"
echo "=========================================================="

USER_NAME="${SUDO_USER:-$USER}"
USER_HOME=$(eval echo "~$USER_NAME")
INSTALL_DIR="$USER_HOME/tugon-pi-server"
mkdir -p "$INSTALL_DIR"

if [ -f "./server.py" ]; then
  cp -f "./server.py" "$INSTALL_DIR/server.py"
elif [ -f "./raspberry-pi-server/server.py" ]; then
  cp -f "./raspberry-pi-server/server.py" "$INSTALL_DIR/server.py"
fi

chmod +x "$INSTALL_DIR/server.py" 2>/dev/null || true

SERVICE_FILE="/etc/systemd/system/tugon-pi-storage.service"

echo "Installing systemd service: $SERVICE_FILE ..."
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=T.U.G.O.N. Barangay 40 & 41 Raspberry Pi 4B Storage Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER_NAME
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/server.py 8000
Restart=always
RestartSec=3
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tugon-pi-storage.service
sudo systemctl restart tugon-pi-storage.service

echo "=========================================================="
echo "  Matagumpay! Tumatakbo na ang T.U.G.O.N. Pi Server 24/7."
echo "  Check status: sudo systemctl status tugon-pi-storage"
echo "  Tunnel (ngrok): ngrok http 8000"
echo "  Tunnel (Cloudflare): cloudflared tunnel --url http://localhost:8000"
echo "=========================================================="
