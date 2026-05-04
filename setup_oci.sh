#!/bin/bash
# ============================================================
#  setup_oci.sh
#  Run once on a fresh OCI Ubuntu 22.04 Ampere A1 instance.
#  Usage: bash setup_oci.sh
# ============================================================

set -e  # Exit immediately on any error

echo "========================================="
echo " OCI Instance Bootstrap — Phase 1"
echo "========================================="

# ------------------------------------------------------------
#  1. System Update
# ------------------------------------------------------------
echo "[1/6] Updating system packages..."
sudo apt-get update -y && sudo apt-get upgrade -y

# ------------------------------------------------------------
#  2. Install Docker
# ------------------------------------------------------------
echo "[2/6] Installing Docker..."
sudo apt-get install -y ca-certificates curl gnupg lsb-release

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add current user to docker group (avoids needing sudo for docker commands)
sudo usermod -aG docker $USER
echo "Docker installed: $(docker --version)"

# ------------------------------------------------------------
#  3. Mount Block Volume
#     Assumes OCI block volume is attached as /dev/sdb.
#     Check with: lsblk
# ------------------------------------------------------------
echo "[3/6] Mounting block volume to /mnt/data..."

BLOCK_DEVICE="/dev/sdb"

if [ -b "$BLOCK_DEVICE" ]; then
    # Format only if not already formatted
    if ! sudo blkid "$BLOCK_DEVICE" | grep -q "ext4"; then
        echo "Formatting $BLOCK_DEVICE as ext4..."
        sudo mkfs.ext4 "$BLOCK_DEVICE"
    else
        echo "$BLOCK_DEVICE already formatted, skipping format."
    fi

    sudo mkdir -p /mnt/data

    # Mount now
    sudo mount "$BLOCK_DEVICE" /mnt/data

    # Persist mount across reboots
    BLOCK_UUID=$(sudo blkid -s UUID -o value "$BLOCK_DEVICE")
    if ! grep -q "$BLOCK_UUID" /etc/fstab; then
        echo "UUID=$BLOCK_UUID /mnt/data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab
        echo "Added to /etc/fstab for persistent mount."
    fi

    sudo mkdir -p /mnt/data/postgres
    sudo chown -R 999:999 /mnt/data/postgres  # UID 999 = postgres user inside container
    echo "Block volume mounted at /mnt/data"
else
    echo "WARNING: $BLOCK_DEVICE not found. Skipping block volume mount."
    echo "Attach your OCI block volume and re-run, or update BLOCK_DEVICE variable."
fi

# ------------------------------------------------------------
#  4. Create Project Directory
# ------------------------------------------------------------
echo "[4/6] Creating project directory..."
mkdir -p ~/sentiment-dashboard
cd ~/sentiment-dashboard

# ------------------------------------------------------------
#  5. Create .env File (prompts user for values)
# ------------------------------------------------------------
echo "[5/6] Setting up .env file..."

if [ ! -f .env ]; then
    read -rp "Enter POSTGRES_USER: " PG_USER
    read -rsp "Enter POSTGRES_PASSWORD: " PG_PASS
    echo ""
    read -rp "Enter POSTGRES_DB name: " PG_DB

    cat > .env <<EOF
POSTGRES_USER=${PG_USER}
POSTGRES_PASSWORD=${PG_PASS}
POSTGRES_DB=${PG_DB}
EOF
    echo ".env file created."
else
    echo ".env already exists, skipping."
fi

# ------------------------------------------------------------
#  6. Configure OCI Firewall (iptables)
#     Port 5432 blocked externally — internal access only.
#     Ports 80 and 443 open for the app (Phases 3–5).
# ------------------------------------------------------------
echo "[6/6] Configuring firewall rules..."
sudo iptables -I INPUT -p tcp --dport 5432 -j DROP         # Block 5432 publicly
sudo iptables -I INPUT -i lo -p tcp --dport 5432 -j ACCEPT # Allow localhost
sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT         # SSH
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT         # HTTP (for later phases)
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT        # HTTPS (for later phases)

# Persist iptables rules across reboots
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

echo ""
echo "========================================="
echo " Bootstrap complete!"
echo " Next steps:"
echo "   cd ~/sentiment-dashboard"
echo "   Place docker-compose.yml and init_db.sql here"
echo "   docker compose up -d"
echo "   docker exec -it sentiment_db psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c '\dt'"
echo "========================================="

# Re-login reminder for docker group
echo ""
echo "NOTE: Log out and back in (or run 'newgrp docker') for Docker group permissions to take effect."
