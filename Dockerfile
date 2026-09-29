# ==========================================
# Synapsis Clínico — Dockerfile para Produção (AWS Lightsail)
# Node.js 22 LTS Alpine Multi-Stage Build
# ==========================================

# Estágio 1: Build da Aplicação (Vite + esbuild)
FROM node:22-alpine AS builder

WORKDIR /app

# Copia manifestos de dependências
COPY package.json package-lock.json ./

# Instala todas as dependências para compilar frontend e backend
RUN npm ci

# Copia código-fonte
COPY . .

# Executa build (Gera dist/ com Vite e dist/server.cjs com esbuild)
RUN npm run build

# ==========================================
# Estágio 2: Runtime de Produção Leve e Otimizado
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3333 \
    DB_FILE_PATH=/app/data/psico_database.sqlite \
    SEED_DEMO_DATA=false \
    APP_MODE=clean

# Instala apenas dependências de produção
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copia artefatos compilados do builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/landing ./landing
COPY --from=builder /app/public ./public

# Cria diretório de persistência de dados (volume para o SQLite)
RUN mkdir -p /app/data

# Usuário não-root para segurança
RUN chown -R node:node /app
USER node

# Porta do serviço
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/api/health || exit 1

# Inicialização
CMD ["node", "dist/server.cjs"]
