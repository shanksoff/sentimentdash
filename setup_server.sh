#!/bin/bash
# ============================================================
#  setup_server.sh
#  Run once on a fresh Ubuntu 22.04 server (Hetzner, DO, etc.)
#  Usage: bash setup_server.sh
# ============================================================

set -e

echo "========================================="
echo " Server Bootstrap"
echo "========================================="

# 1. System update
echo "[1/4] Updating system packages..."
apt-get update -y && apt-get upgrade -y

# 2. Install Docker
echo "[2/4] Installing Docker..."
apt-get install -y ca-certificates curl
curl -fsSL https://get.docker.com | sh
echo "Docker installed: $(docker --version)"

# 3. Open firewall ports
echo "[3/4] Configuring firewall..."
apt-get install -y ufw
ufw allow 22
ufw allow 80
ufw allow 443
ufw --force enable

# 4. Clone project
echo "[4/4] Cloning project..."
read -rp "GitHub repo URL (e.g. https://github.com/user/sentimentdash.git): " REPO_URL
git clone "$REPO_URL" ~/sentimentdash
cd ~/sentimentdash

echo ""
echo "========================================="
echo " Bootstrap complete!"
echo " Next steps:"
echo "   cd ~/sentimentdash"
echo "   nano .env          # add your secrets"
echo "   docker compose up -d --build"
echo "========================================="
