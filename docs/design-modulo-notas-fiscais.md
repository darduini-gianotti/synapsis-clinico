# Especificação de Design: Módulo de Controle de Notas Fiscais e Solicitação Contábil

## 1. Visão Geral e Propósito
Este documento especifica a arquitetura técnica e o fluxo de experiência de usuário para o gerenciamento de Notas Fiscais (NFs) no software **PsicoGestão SaaS**.
O objetivo é integrar o momento de quitação financeira com a solicitação de emissão de NF para a contabilidade via WhatsApp, suportar emissão consolidada mensal ou antecipada (reembolso de plano de saúde) e centralizar o controle de emissão, anexo de arquivos e entrega da nota ao paciente.

---

## 2. Understanding Summary (Resumo de Entendimento)
- **Gatilho na Baixa:** O modal "Dar Baixa de Pagamento de Sessões" recebe a opção de solicitar NF, abrindo imediatamente a mensagem pré-formatada para o WhatsApp da contabilidade.
- **Painel de Controle de NF:** 3ª aba principal dentro do Financeiro (`NOTAS FISCAIS`), permitindo acompanhamento por status (*Pendente de Envio*, *Solicitada*, *Emitida*, *Cancelada*).
- **Atendimentos Futuros & Sessões Pagas:** Botão "+ Nova Solicitação de NF" permite criar solicitações tanto de sessões quitadas ao longo do mês quanto de sessões futuras agendadas para reembolso antecipado de convênio.
- **Conclusão da NF:** Registro do número da nota, data de emissão e upload do PDF da NF, com sincronização automática na pasta de Documentos do Paciente e atalho de envio ao paciente por WhatsApp.
- **Aba Contabilidade:** Configuração completa em Configurações (contato do escritório, dados fiscais da clínica e editor de template da mensagem com tags dinâmicas).
- **Controle de Acesso (RBAC):** Permissão modular que permite à clínica ocultar totalmente o módulo fiscal dos psicólogos (gestão centralizada) ou conceder acesso conforme o modelo de trabalho.

---

## 3. Premissas e Suposições
- A emissão oficial das notas continua a cargo do escritório de contabilidade parceiro (não há integração SOAP/REST com prefeitura nesta fase).
- Os links de WhatsApp utilizam o protocolo direto `api.whatsapp.com/send` sem custos de provedores intermediários.
- Uma sessão só pode estar associada a uma solicitação de NF ativa por vez, prevenindo duplicidade fiscal.
- O anexo em PDF da NF é armazenado localmente em SQLite com integridade via hash SHA-256.

---

## 4. Decision Log (Histórico de Decisões)
- **D1:** Entrada híbrida no controle de NF (marcação opcional na baixa + solicitação manual sob demanda).
- **D2:** Atendimentos futuros/reembolso iniciados via botão dedicado "+ Nova Solicitação" no módulo de NF.
- **D3:** Transição imediata: salvar a baixa com NF marcada abre o modal de WhatsApp no mesmo instante.
- **D4:** NF emitida vincula aos documentos do paciente com atalho de envio da nota via WhatsApp.
- **D5:** Aba de contabilidade completa (dados do escritório, dados fiscais da clínica e template customizável).
- **D6:** Armazenamento local seguro do PDF com hash SHA-256 e trilha de auditoria (`audit_logs`).
- **D7:** Arquitetura relacional dedicada (`invoices` e `invoice_items`), garantindo rastreabilidade precisa.
- **D8:** O modal de nova solicitação agrupa com clareza sessões pagas sem NF (para consolidação de fim de mês) e sessões futuras (para reembolso).
- **D9:** Controle de visualização fiscal 100% configurável via RBAC (`view_invoices`, `manage_invoices`), atendendo clínicas com financeiro sigiloso/centralizado e consultórios autônomos.

---

## 5. Arquitetura do Banco de Dados (SQLite)

### Tabela `invoices`
```sql
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  psychologist_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK(status IN ('PENDING_DISPATCH', 'REQUESTED', 'ISSUED', 'CANCELED')),
  total_amount REAL NOT NULL,
  invoice_number TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  issued_at DATETIME,
  file_name TEXT,
  file_size INTEGER,
  file_type TEXT,
  file_data TEXT, -- Base64 do PDF
  hash_sha256 TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (psychologist_id) REFERENCES users(id)
);
```

### Tabela `invoice_items`
```sql
CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  session_id INTEGER NOT NULL,
  session_date DATETIME NOT NULL,
  session_price REAL NOT NULL,
  is_future_reimbursement INTEGER DEFAULT 0,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### Extensão `clinic_settings`
```sql
ALTER TABLE clinic_settings ADD COLUMN accounting_info_json TEXT;
```

---

## 6. Endpoints da API (Backend Express)
- `GET /api/invoices`: Lista NFs com filtros de status, período e busca por paciente.
- `POST /api/invoices`: Cria uma solicitação de NF vinculando sessões selecionadas.
- `PUT /api/invoices/:id/status`: Atualiza status (ex: marcar como enviada via WhatsApp).
- `POST /api/invoices/:id/complete`: Conclui a NF com número, data de emissão e upload do PDF em Base64.
- `DELETE /api/invoices/:id`: Cancela uma solicitação de NF.
- `GET /api/invoices/available-sessions/:patientId`: Retorna sessões disponíveis do paciente para emissão de NF (sessões pagas sem NF vinculada e sessões futuras/pendentes).
- `GET /api/settings/accounting`: Obtém configurações contábeis.
- `PUT /api/settings/accounting`: Atualiza dados do escritório, dados fiscais e template da mensagem.

---

## 7. Componentes e Telas no Frontend (React)
1. **`FinancialModule.tsx`:**
   - Adição do botão da 3ª aba: `[NOTAS FISCAIS]` ao lado de `[RECEITAS]` e `[DESPESAS]`.
   - Grid de listagem de NFs com status badges, filtros e totais.
   - Ajuste no modal `Dar Baixa` com checkbox `Solicitar NF à Contabilidade`.
2. **`InvoiceRequestModal.tsx`:**
   - Modal com balão autêntico de WhatsApp, seletor de sessões (pagas / futuras), prévia do texto e botão de envio direto para a contabilidade.
3. **`InvoiceCompleteModal.tsx`:**
   - Modal para preenchimento do número da NF, data e upload do PDF.
   - Ação imediata pós-salvar: botão "Enviar NF ao Paciente via WhatsApp".
4. **`SettingsModule.tsx`:**
   - Nova aba "Contabilidade" com formulário dos 3 blocos (Escritório, Dados Fiscais e Editor de Mensagem com variáveis).
5. **`CollaboratorsModule.tsx`:**
   - Adição do módulo `invoices` na matriz de permissões RBAC.