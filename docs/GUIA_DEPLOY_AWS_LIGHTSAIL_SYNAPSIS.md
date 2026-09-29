# 🚀 Guia Passo a Passo: Deploy na AWS Lightsail & Teste com Consultório Real

Este guia orienta a implantação completa do **Synapsis Clínico** e da **Landing Page** na infraestrutura da **Amazon Web Services (AWS)** em **São Paulo (sa-east-1)**, com cópia totalmente em branco do banco de dados e pronta para importação dos dados reais do **PsicoManager**.

---

## 📋 Pré-requisitos & Visão Geral da Arquitetura

* **Servidor Nuvem:** Instância **AWS Lightsail** (Plano inicial: \$5.00 / mês - 1 vCPU, 1 GB RAM, 40 GB SSD NVMe).
* **Localização Física:** Região **São Paulo (`sa-east-1`)** para atender aos requisitos de conformidade com a LGPD e menor latência.
* **Persistência de Dados:** O banco de dados SQLite fica salvo em um volume montado no disco persistente da máquina (`./data`), protegido de reinicializações e atualizações de versão.
* **Landing Page & App Unificados:**
  * **App de Gestão:** `http://IP_DA_AWS:3000` (ou seu domínio oficial `app.seusite.com.br`).
  * **Landing Page de Conversão:** `http://IP_DA_AWS:3000/landing` (ou `seusite.com.br`).

---

## 🛠️ Passo 1: Criando a Instância no AWS Lightsail

1. Acesse o console da AWS: [https://lightsail.aws.amazon.com/](https://lightsail.aws.amazon.com/)
2. Clique em **Create instance** (Criar instância).
3. **Location (Região):** Selecione **São Paulo, Zona A / B / C (`sa-east-1`)**. *(Fundamental para estar em território nacional)*.
4. **Select a platform:** Escolha **Linux/Unix**.
5. **Select a blueprint:** Escolha **OS Only** ➡️ **Ubuntu 24.04 LTS** (ou Ubuntu 22.04 LTS).
6. **Choose your instance plan:** Selecione o plano de **\$5.00 USD / mês** (1 GB de RAM, 1 vCPU, 40 GB SSD).
7. **Identify your instance:** Dê um nome, por exemplo: `synapsis-consultorio-prod`.
8. Clique no botão inferior **Create instance**. Em menos de 2 minutos ela estará ativa (`Running`).

---

## 🔒 Passo 2: Configurando o Firewall da Instância (Portas de Acesso)

No painel da sua instância recém-criada no Lightsail:
1. Vá na aba **Networking** (Rede).
2. Na seção **IPv4 Firewall**, adicione as seguintes regras:
   * **Custom / TCP**: Porta `3000` (ou se for usar Nginx com domínio: portas `80` HTTP e `443` HTTPS).
3. Na mesma aba, clique em **Attach static IP** (Fixar IP estático). Isso garante que o endereço IP da AWS não mude se a máquina reiniciar.

---

## 💻 Passo 3: Instalando o Docker na Instância AWS

Conecte-se na máquina clicando no botão **Connect using SSH** (ícone de terminal laranja no Lightsail). Na janela preta do terminal, execute os comandos:

```bash
# 1. Atualizar pacotes do Ubuntu
sudo apt update && sudo apt upgrade -y

# 2. Instalar Docker e Docker Compose
sudo apt install -y docker.io docker-compose

# 3. Permitir que o usuário execute Docker sem sudo
sudo usermod -aG docker ubuntu
newgrp docker

# 4. Verificar se o Docker está ativo
docker --version && docker-compose --version
```

---

## 📦 Passo 4: Clonando o Projeto e Configurando as Variáveis

Ainda no terminal SSH da AWS:

```bash
# 1. Clonar o repositório do projeto (ou transferir os arquivos via git / scp)
git clone https://github.com/SEU_USUARIO/psicogestao.git /home/ubuntu/app
cd /home/ubuntu/app

# 2. Criar o diretório de dados persistentes
mkdir -p data

# 3. Configurar as variáveis de ambiente com os dados do consultório
cp .env.production.example .env
nano .env
```

No editor `nano`, preencha os dados reais do consultório da sua esposa:
```env
PORT=3000
NODE_ENV=production
SEED_DEMO_DATA=false
APP_MODE=clean
DB_FILE_PATH=/app/data/psico_database.sqlite

# Dados reais do primeiro acesso:
ADMIN_NAME=Dra. Nome da Esposa
ADMIN_EMAIL=esposa@consultorio.com.br
ADMIN_PASSWORD=DefinaUmaSenhaForte123!
ADMIN_CRP=CRP 06/123456-SP
CLINIC_NAME=Consultório de Psicologia Dra. Nome

JWT_SECRET=sua_chave_secreta_jwt_longa_e_aleatoria
```
*(Pressione `Ctrl + O` e depois `Enter` para salvar, e `Ctrl + X` para sair do nano).*

---

## 🚀 Passo 5: Inicializando a Aplicação

Com o arquivo `.env` preenchido, execute um único comando:

```bash
docker-compose up -d --build
```

O Docker fará o build do frontend e do backend, inicializará a imagem e colocará o container para rodar em segundo plano.

### Para verificar se está tudo funcionando:
```bash
docker ps
docker logs -f synapsis_app
```
Você verá a mensagem:
> `🌱 Inicializando banco limpo em branco para produção/consultório real...`  
> `Server running on http://localhost:3000`

---

## 🌐 Passo 6: Acessando e Testando a Importação do PsicoManager

Abra o navegador no seu computador ou celular:

1. **Landing Page:**  
   `http://SEU_IP_ESTATICO:3000/landing`  
   *(Verifique o selo da AWS no topo, na tabela e no rodapé)*.

2. **Acesso ao Sistema (App em Branco):**  
   `http://SEU_IP_ESTATICO:3000/`  
   * Faça login com o e-mail e senha configurados no `.env` (`esposa@consultorio.com.br`).
   * Observe que a lista de pacientes está **100% vazia**, sem nenhum dado falso de demonstração.

3. **Importação dos Dados do PsicoManager:**
   * No menu lateral, clique em **Pacientes** (`/patients`).
   * Clique no botão **"Migrador Universal"** (ou **"Importar PsicoManager"**).
   * Selecione a planilha exportada do PsicoManager da sua esposa (`.xlsx` ou `.csv`).
   * O sistema automaticamente fará a pré-visualização, validará os CPFs, telefones e vínculos de responsáveis.
   * Clique em **"Executar Migração"**.
   * Em instantes, todos os pacientes reais do consultório estarão cadastrados, higienizados e prontos para atendimento!

---

## 🛡️ Passo 7: Ativando Snapshots Automáticos (Backup AWS)

Para garantir a **guarda legal de 5 anos do CFP**:
1. No painel do Lightsail, entre na sua instância.
2. Vá na aba **Snapshots**.
3. Ative a chave **Automatic snapshots**.
4. Defina o horário preferido (ex: `03:00 UTC` - meia-noite no Brasil).
5. A AWS criará cópias de segurança diárias completas de todo o servidor e do banco de dados automaticamente.
