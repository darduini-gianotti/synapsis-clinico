# Especificação de Design: Gestão de Acessos, Onboarding Seguro e Política de Senhas

## 1. Resumo do Entendimento (Understanding Summary)
O sistema de Gestão de Acessos do **PsicoGestão** foi desenhado para atender aos mais altos padrões de segurança, privacidade clínica (CFP/LGPD) e governança corporativa. Elimina a criação de senhas provisórias manuais por administradores, introduzindo um fluxo de convite por e-mail com token criptográfico de uso único, validação em tempo real de senha forte, autoatendimento de esquecimento de senha, proteção contra ataques de força bruta e mecanismo imediato de revogação de credenciais (*Kill Switch*).

---

## 2. Registro Consolidado de Decisões (Decision Log)

| ID | Decisão Aprovada | Justificativa Técnica & Clínica |
| :--- | :--- | :--- |
| **DEC-01** | **Convite por E-mail com Token Seguro (1º Acesso)** | O Administrador cadastra apenas Nome, E-mail, Perfil e CRP. A conta nasce em `PENDING_ACTIVATION` e o colaborador recebe link com token criptográfico válido por 24h para definir sua própria senha no 1º acesso. |
| **DEC-02** | **Política Forte de Senhas + Checklist Visual** | Exigência estrita de: mínimo 8 caracteres, 1 letra maiúscula, 1 letra minúscula, 1 número e 1 caractere especial (`!@#$%^&*`). Interface conta com medidor de força e checklist em tempo real. |
| **DEC-03** | **Duplo Canal de Redefinição (Reset)** | O próprio colaborador pode solicitar o link de redefinição na tela de Login (*"Esqueci minha senha"*, token válido por 1h) ou o Administrador pode disparar um link de suporte diretamente pelo painel. |
| **DEC-04** | **Serviço Híbrido de E-mails Transacionais** | Suporta envio real por SMTP via `.env` e disponibiliza um visualizador/simulador de e-mails em tela com botão direto para testes imediatos no navegador em ambiente de desenvolvimento ou demonstração. |
| **DEC-05** | **Tokens Criptográficos Armazenados no SQLite (`auth_tokens`)** | Tokens aleatórios de 64 caracteres hex (`crypto.randomBytes`), com controle de expiração, status de uso único e revogação automática de tokens anteriores quando um novo é emitido. |
| **DEC-06** | **Revogação Imediata de Credenciais (*Kill Switch / Offboarding*)** | Controle de `token_version` na tabela `users`: o Administrador pode derrubar na hora qualquer sessão ativa de um colaborador desligado ou comprometido, rejeitando imediatamente requisições subsequentes. |

---

## 3. Modelo de Dados (SQLite)

### A. Tabela `auth_tokens`
```sql
CREATE TABLE IF NOT EXISTS auth_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT UNIQUE NOT NULL,
  token_type TEXT NOT NULL CHECK(token_type IN ('INVITE', 'RESET')),
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### B. Colunas Adicionadas na Tabela `users`
- `status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE', 'PENDING_ACTIVATION', 'BLOCKED'))`
- `failed_login_attempts INTEGER NOT NULL DEFAULT 0`
- `locked_until DATETIME`
- `token_version INTEGER NOT NULL DEFAULT 1`

---

## 4. Endpoints da API

| Método | Rota | Autenticação | Descrição |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/collaborators/invite` | Sim (Admin) | Cadastra novo colaborador sem senha (`PENDING_ACTIVATION`), gera token de 24h e dispara convite. |
| `POST` | `/api/collaborators/:id/resend-invite` | Sim (Admin) | Invalida convites anteriores e gera novo link com token de 24h. |
| `POST` | `/api/collaborators/:id/trigger-reset` | Sim (Admin) | Dispara e-mail assistido de redefinição de senha para o colaborador. |
| `POST` | `/api/collaborators/:id/revoke-access` | Sim (Admin) | *Kill Switch*: incrementa `token_version`, define status `BLOCKED` e anula tokens pendentes. |
| `POST` | `/api/collaborators/:id/unlock` | Sim (Admin) | Destrava conta bloqueada por tentativas de senha e zera `failed_login_attempts`. |
| `POST` | `/api/auth/forgot-password` | Pública | Solicitação de reset por e-mail pelo próprio colaborador (token de 1h). |
| `GET` | `/api/auth/verify-token` | Pública | Valida existência, validade e tipo de token (`INVITE` ou `RESET`). |
| `POST` | `/api/auth/set-password` | Pública | Valida os 4 critérios de senha, salva `bcrypt`, ativa conta e invalida token. |

---

## 5. Componentes Frontend

1. **`CollaboratorsModule.tsx`**:
   - Modal de criação simplificado (Nome, E-mail, Perfil, CRP).
   - Coluna de Status com tags coloridas: `Ativo` (verde), `Convite Pendente` (âmbar), `Bloqueado` (vermelho).
   - Menu de ações com *Reenviar Convite*, *Redefinir Senha*, *Desbloquear* e *Derrubar Acesso*.
2. **`LoginModal.tsx`**:
   - Link discreto *"Esqueci minha senha"*.
   - Formulário de autoatendimento com proteção contra enumeração de e-mails.
3. **`PasswordActionModal.tsx`**:
   - Interface de definição de senha com validação reativa dos 4 requisitos:
     - Mínimo de 8 caracteres
     - Letra maiúscula
     - Letra minúscula
     - Número e símbolo especial (`@$!%*?&`)
   - Barra de progresso de força (Fraca / Média / Forte) e confirmação de senha.
4. **`EmailPreviewModal.tsx`**:
   - Modal com o layout do e-mail transacional e botão *"Abrir Link de Ativação / Redefinição"*, viabilizando testes instantâneos no navegador.
