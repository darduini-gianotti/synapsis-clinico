#!/bin/bash
# ==========================================
# ssl-setup.sh — Configura HTTPS com Let's Encrypt (Certbot)
# Execute no servidor após o DNS já estar apontando para o IP
#
# COMO USAR (no servidor via SSH):
#   chmod +x /srv/synapsis/deploy/ssl-setup.sh
#   ./ssl-setup.sh
# ==========================================

set -e

EMAIL="sergio@psicogestao.com.br"  # E-mail para notificações do certificado

echo "🔐 Configurando certificados SSL Let's Encrypt..."
echo ""

# Staging
echo "📋 Certificado para staging.synapsisclinico.com.br..."
sudo certbot --nginx \
  -d staging.synapsisclinico.com.br \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --redirect

echo "✅ Certificado staging configurado."
echo ""

# Produção
echo "📋 Certificado para app.synapsisclinico.com.br..."
sudo certbot --nginx \
  -d app.synapsisclinico.com.br \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --redirect

echo "✅ Certificado produção configurado."
echo ""

# Verifica renovação automática
echo "🔄 Testando renovação automática..."
sudo certbot renew --dry-run

echo ""
echo "✅ SSL configurado com sucesso para ambos os ambientes!"
echo "   Staging:    https://staging.synapsisclinico.com.br"
echo "   Produção:   https://app.synapsisclinico.com.br"
echo ""
echo "⏰ Renovação automática já configurada via cron do certbot."
