#!/bin/bash
# ==========================================
# setup-server.sh — Instalação inicial do servidor AWS Lightsail
# Execute uma vez após criar a instância Ubuntu 22.04
#
# COMO USAR:
#   chmod +x setup-server.sh
#   ./setup-server.sh
# ==========================================

set -e

echo "🚀 Iniciando setup do servidor Synapsis Clínico na AWS..."

# ------------------------------------------
# 1. Atualiza o sistema
# ------------------------------------------
echo "📦 Atualizando pacotes do sistema..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ------------------------------------------
# 2. Instala dependências base
# ------------------------------------------
echo "🔧 Instalando dependências..."
sudo apt-get install -y \
  curl \
  wget \
  git \
  unzip \
  nginx \
  certbot \
  python3-certbot-nginx \
  ufw

# ------------------------------------------
# 3. Instala Node.js 22 via NodeSource
# ------------------------------------------
echo "⬢ Instalando Node.js 22 LTS..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# ------------------------------------------
# 4. Instala Docker e Docker Compose
# ------------------------------------------
echo "🐳 Instalando Docker..."
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER

sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "Docker version: $(sudo docker --version)"
echo "Docker Compose version: $(sudo docker-compose --version)"

# ------------------------------------------
# 5. Cria estrutura de diretórios do projeto
# ------------------------------------------
echo "📁 Criando estrutura de diretórios..."
sudo mkdir -p /srv/synapsis/data/staging
sudo mkdir -p /srv/synapsis/data/production
sudo chown -R $USER:$USER /srv/synapsis

# ------------------------------------------
# 6. Configura Firewall (UFW)
# ------------------------------------------
echo "🔒 Configurando firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# ------------------------------------------
# 7. Configura Nginx
# ------------------------------------------
echo "🌐 Configurando Nginx..."
sudo mkdir -p /etc/nginx/sites-available
sudo mkdir -p /etc/nginx/sites-enabled

# Remove config padrão
sudo rm -f /etc/nginx/sites-enabled/default

# ------------------------------------------
# 8. Habilita Nginx no boot
# ------------------------------------------
sudo systemctl enable nginx
sudo systemctl start nginx

echo ""
echo "✅ Setup concluído com sucesso!"
echo ""
echo "PRÓXIMOS PASSOS:"
echo "1. Faça upload do arquivo .env.server para /srv/synapsis/.env"
echo "2. Execute: ./deploy.sh staging   (para staging)"
echo "3. Execute: ./deploy.sh production (para produção)"
echo ""
echo "IPs disponíveis:"
hostname -I
