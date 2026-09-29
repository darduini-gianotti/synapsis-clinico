#!/bin/bash
# ==========================================
# deploy.sh — Deploy do Synapsis Clínico na AWS
#
# COMO USAR (na sua máquina local):
#   ./deploy/deploy.sh staging    → deploy no ambiente de staging
#   ./deploy/deploy.sh production → deploy no ambiente de produção
#
# VARIÁVEIS NECESSÁRIAS (configure abaixo ou via .env.deploy):
#   SSH_KEY_PATH   → Caminho para o arquivo .pem da AWS
#   SERVER_IP      → IP estático da instância Lightsail
# ==========================================

set -e

ENVIRONMENT=${1:-"staging"}

# ------------------------------------------
# Configuração — EDITE AQUI antes do primeiro deploy
# ------------------------------------------
SSH_KEY_PATH="${SSH_KEY_PATH:-$HOME/.ssh/synapsis-lightsail.pem}"

if [ "$ENVIRONMENT" = "staging" ]; then
  SERVER_IP="${STAGING_SERVER_IP:-3.129.124.25}"
  DOMAIN="staging.synapsisclinico.com.br"
  PROFILE="staging"
  COMPOSE_PORT="3333"
elif [ "$ENVIRONMENT" = "production" ]; then
  SERVER_IP="${PROD_SERVER_IP:-3.136.129.23}"
  DOMAIN="app.synapsisclinico.com.br"
  PROFILE="production"
  COMPOSE_PORT="3334"
else
  echo "❌ Ambiente inválido. Use: staging ou production"
  exit 1
fi

SERVER_USER="ubuntu"
REMOTE_DIR="/srv/synapsis"

echo ""
echo "═══════════════════════════════════════════════"
echo "  🚀 Deploy Synapsis Clínico → $ENVIRONMENT"
echo "  🌐 Domínio: $DOMAIN"
echo "  🖥️  Servidor: $SERVER_IP"
echo "═══════════════════════════════════════════════"
echo ""

# ------------------------------------------
# 1. Build local da aplicação
# ------------------------------------------
echo "🔨 [1/6] Gerando build de produção..."
npm run build
echo "✅ Build gerado com sucesso."

# ------------------------------------------
# 2. Cria pacote de deploy (exclui node_modules e db)
# ------------------------------------------
echo "📦 [2/6] Empacotando arquivos para envio..."
DEPLOY_PACKAGE="/tmp/synapsis-deploy-$(date +%Y%m%d%H%M%S).tar.gz"

tar -czf "$DEPLOY_PACKAGE" \
  --exclude="./node_modules" \
  --exclude="./.git" \
  --exclude="./data" \
  --exclude="./*.sqlite*" \
  --exclude="./scratch" \
  --exclude="./temp_*" \
  --exclude="./tests" \
  dist/ \
  landing/ \
  public/ \
  deploy/ \
  docker-compose.yml \
  Dockerfile \
  package.json \
  package-lock.json

echo "✅ Pacote criado em: $DEPLOY_PACKAGE"

# ------------------------------------------
# 3. Envia pacote para o servidor
# ------------------------------------------
echo "📤 [3/6] Enviando arquivos para $SERVER_IP..."
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR"

scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "$DEPLOY_PACKAGE" "$SERVER_USER@$SERVER_IP:/tmp/synapsis-deploy.tar.gz"

scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "deploy/nginx.conf" "$SERVER_USER@$SERVER_IP:/tmp/synapsis-nginx.conf"

echo "✅ Arquivos enviados."

# ------------------------------------------
# 4. Extrai e configura no servidor remoto
# ------------------------------------------
echo "⚙️  [4/6] Configurando servidor remoto..."
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "$SERVER_USER@$SERVER_IP" << REMOTE_SCRIPT
  set -e

  # Extrai pacote no diretório do projeto
  cd $REMOTE_DIR
  tar -xzf /tmp/synapsis-deploy.tar.gz
  rm -f /tmp/synapsis-deploy.tar.gz

  # Instala dependências de produção
  npm ci --omit=dev

  # Copia nginx config
  sudo cp /tmp/synapsis-nginx.conf /etc/nginx/nginx.conf
  sudo nginx -t && sudo systemctl reload nginx

  echo "Servidor configurado com sucesso."
REMOTE_SCRIPT

echo "✅ Configuração remota concluída."

# ------------------------------------------
# 5. Inicia / Reinicia container Docker
# ------------------------------------------
echo "🐳 [5/6] (Re)iniciando container $ENVIRONMENT..."
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no \
  "$SERVER_USER@$SERVER_IP" << REMOTE_SCRIPT
  set -e
  cd $REMOTE_DIR

  # Para container anterior se existir
  sudo docker-compose --profile $PROFILE down 2>/dev/null || true

  # Reconstrói imagem e sobe container
  sudo docker-compose --profile $PROFILE build --no-cache
  sudo docker-compose --profile $PROFILE up -d

  echo "Container $ENVIRONMENT iniciado."
  sudo docker ps
REMOTE_SCRIPT

echo "✅ Container $ENVIRONMENT em execução."

# ------------------------------------------
# 6. Verifica saúde do serviço
# ------------------------------------------
echo "🏥 [6/6] Verificando saúde do serviço..."
sleep 5

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "http://$SERVER_IP:$COMPOSE_PORT/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Serviço respondendo com status 200!"
else
  echo "⚠️  Serviço retornou status $HTTP_STATUS (pode estar subindo ainda)"
  echo "   Verifique com: ssh -i $SSH_KEY_PATH $SERVER_USER@$SERVER_IP 'sudo docker logs synapsis_$ENVIRONMENT'"
fi

rm -f "$DEPLOY_PACKAGE"

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✅ DEPLOY $ENVIRONMENT CONCLUÍDO!"
echo "  🌐 Acesse: https://$DOMAIN"
echo "═══════════════════════════════════════════════"
echo ""
