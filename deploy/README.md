# Synapsis Clínico — Deploy na AWS Lightsail

## Passo a passo completo para o deploy

### Arquivos deste diretório

| Arquivo | Descrição |
|---|---|
| `deploy.sh` | Script principal de deploy (execute localmente) |
| `setup-server.sh` | Instalação inicial do servidor (execute 1x via SSH) |
| `ssl-setup.sh` | Configura HTTPS com Let's Encrypt (execute 1x via SSH) |
| `nginx.conf` | Configuração do reverse proxy |
| `.env.server.example` | Template das variáveis de ambiente do servidor |

---

### Sequência de Deploy (Primeira vez)

#### 1. No Console AWS Lightsail
1. Crie 2 instâncias Ubuntu 22.04 → plano $5/mês → região São Paulo
2. Nomeie como `synapsis-staging` e `synapsis-production`
3. Aloque IPs Estáticos para cada uma
4. Abra portas 80, 443 e 22 no firewall de cada instância
5. Baixe o par de chaves `.pem`

#### 2. No seu Registro de Domínio (synapsisclinico.com.br)
```
A → staging.synapsisclinico.com.br → 3.129.124.25
A → app.synapsisclinico.com.br     → 3.136.129.23
```

#### 3. Configure credenciais locais
```bash
# Salve a chave SSH com permissões corretas
cp ~/Downloads/synapsis-lightsail.pem ~/.ssh/synapsis-lightsail.pem
chmod 400 ~/.ssh/synapsis-lightsail.pem

# Copie e preencha o .env de deploy
cp deploy/.env.server.example deploy/.env.server
# Edite deploy/.env.server com os IPs reais e chaves geradas
```

#### 4. Setup inicial do servidor (apenas 1 vez por instância)
```bash
# Acessa o servidor via SSH
ssh -i ~/.ssh/synapsis-lightsail.pem ubuntu@SEU_IP_STAGING

# No servidor, execute:
curl -fsSL https://raw.githubusercontent.com/.../setup-server.sh | bash
```

#### 5. Deploy do Staging
```bash
source deploy/.env.server
bash deploy/deploy.sh staging
```

#### 6. Configure SSL (depois que o DNS propagar ~10 min)
```bash
ssh -i ~/.ssh/synapsis-lightsail.pem ubuntu@SEU_IP
bash /srv/synapsis/deploy/ssl-setup.sh
```

#### 7. Deploy de Produção
```bash
source deploy/.env.server
bash deploy/deploy.sh production
```

---

### Deploys subsequentes (após o setup inicial)

```bash
# Staging
source deploy/.env.server && bash deploy/deploy.sh staging

# Produção
source deploy/.env.server && bash deploy/deploy.sh production
```

---

### Logs e Monitoramento

```bash
# Ver logs do container staging
ssh -i ~/.ssh/synapsis-lightsail.pem ubuntu@IP_STAGING \
  "sudo docker logs synapsis_staging --tail 100 -f"

# Ver logs do container produção
ssh -i ~/.ssh/synapsis-lightsail.pem ubuntu@IP_PROD \
  "sudo docker logs synapsis_production --tail 100 -f"

# Health check
curl https://app.synapsisclinico.com.br/api/health
```
