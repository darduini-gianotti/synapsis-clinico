# Especificação de Design: Módulo Premium de Emissão Automática de NFS-e (Nuvem Fiscal)

## 1. Visão Geral e Propósito
Este documento detalha o design técnico, de negócio e de experiência do usuário (UX) para a introdução do **Módulo de Emissão Direta de Notas Fiscais de Serviços Eletrônicas (NFS-e)** no **PsicoGestão SaaS**.

O objetivo primordial é equiparar o PsicoGestão aos padrões dos líderes de mercado (como o PsicoManager) no segmento **PREMIUM**, permitindo que clínicas e consultórios PJ com Certificado Digital A1 emitam notas fiscais oficiais com **1 clique** diretamente pelo sistema, eliminando a dependência de processos manuais de preenchimento em portais de prefeituras ou envio de solicitações isoladas à contabilidade.

A solução é desenhada sobre um modelo **Híbrido Opcional**, garantindo total compatibilidade com psicólogos autônomos (PF) ou usuários que preferem manter o fluxo assistido de WhatsApp e inserção manual.

---

## 2. Understanding Summary (Resumo de Entendimento)
* **O que está sendo construído:** Um módulo opcional de mensageria fiscal que permite a emissão direta de NFS-e oficial integrada com prefeituras via API REST do gateway nacional **Nuvem Fiscal**.
* **Por que existe:** Para automatizar o ciclo financeiro-fiscal das clínicas, reduzindo o tempo de faturamento a zero e entregando uma experiência fluida de produto Premium.
* **Para quem é:** Clínicas e psicólogos PJ cadastrados com CNPJ e Certificado Digital A1 que contratarem o plano/módulo Premium; mantém-se o fluxo manual/WhatsApp para autônomos PF.
* **Gatilho de Emissão:** 1 Clique imediato na baixa da sessão financeira ou emissão consolidada em lote na aba de Notas Fiscais.
* **Inteligência Clínica:** Suporte automático ao tomador (paciente vs. responsável financeiro/pais de menor) e discriminação detalhada dos atendimentos para aprovação de reembolso por planos de saúde e IRPF.
* **Armazenamento e Entrega:** Baixa autônoma do DANFSE (PDF) e do XML assinado, vinculando ao prontuário (`patient_documents`) com hash SHA-256 e disponibilizando envio imediato ao paciente/responsável via WhatsApp.
* **Não-Metas Explícitas:** Não substitui a contabilidade da clínica para apuração de impostos (DAS, Simples Nacional, IRPJ); não cria conectores municipais SOAP proprietários do zero.

---

## 3. Decision Log (Histórico de Decisões do Brainstorming)

* **D1 — Escopo Híbrido Opcional:** Coexistência harmônica. O fluxo manual (WhatsApp + upload manual do PDF) permanece ativo para quem desejar. A emissão direta é ativada mediante contratação ou habilitação do recurso Premium.
* **D2 — Experiência com 1 Clique:** Eliminação de etapas intermediárias quando o modo automático estiver ativo. Ao dar baixa financeira, o sistema já dispara e autoriza a nota na prefeitura.
* **D3 — Provedor de Mensageria Fiscal:** Seleção da **Nuvem Fiscal** como provedor de gateway centralizado gerenciado pelo PsicoGestão, proporcionando modelo plug-and-play (upload de Certificado A1 + Inscrição Municipal na clínica) sem necessidade do cliente abrir contas de desenvolvedor em terceiros.
* **D4 — Tomador Flexível & Discriminação:** Detecção inteligente de responsável financeiro cadastrado para dependentes e discriminação detalhada das datas/valores de cada sessão no corpo da NFS-e.
* **D5 — Tolerância a Falhas e Resiliência:** Arquitetura assíncrona tolerante a oscilações de prefeituras com Webhooks e opção de fallback em 1 clique para o WhatsApp caso o município esteja inoperante.
* **D6 — Bypass do Modal Manual:** Para notas emitidas pelo gateway, o `InvoiceCompleteModal` é dispensado, pois o número da nota, data, XML e PDF são persistidos automaticamente pela API.

---

## 4. Arquitetura de Dados (Banco de Dados)

### 4.1. Extensão da Tabela `invoices`
Novos campos adicionados à tabela existente:
```sql
ALTER TABLE invoices ADD COLUMN emission_mode TEXT DEFAULT 'MANUAL' CHECK(emission_mode IN ('MANUAL', 'AUTOMATED'));
ALTER TABLE invoices ADD COLUMN gateway_reference_id TEXT;
ALTER TABLE invoices ADD COLUMN rps_number INTEGER;
ALTER TABLE invoices ADD COLUMN rps_series TEXT;
ALTER TABLE invoices ADD COLUMN xml_data TEXT;
ALTER TABLE invoices ADD COLUMN error_details TEXT;
ALTER TABLE invoices ADD COLUMN cancellation_reason TEXT;
```

### 4.2. Tabela de Credenciais Fiscais (`clinic_fiscal_credentials`)
Armazena o Certificado Digital A1 de forma segura e criptografada:
```sql
CREATE TABLE IF NOT EXISTS clinic_fiscal_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clinic_id INTEGER NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 0,
  tax_regime TEXT NOT NULL DEFAULT 'SIMPLES_NACIONAL' CHECK(tax_regime IN ('SIMPLES_NACIONAL', 'LUCRO_PRESUMIDO', 'MEI')),
  cnpj TEXT NOT NULL,
  municipal_registration TEXT NOT NULL,
  city_ibge_code TEXT NOT NULL,
  service_item_code TEXT DEFAULT '04.16', -- Item 04.16: Psicologia / Psicanálise
  cnae_code TEXT DEFAULT '8650-0/03',
  iss_rate REAL DEFAULT 2.0, -- Alíquota em porcentagem (ex: 2.0% a 5.0%)
  certificate_pfx_encrypted BLOB, -- Certificado A1 .pfx criptografado com AES-256-GCM
  certificate_pass_encrypted TEXT, -- Senha do certificado criptografada
  certificate_valid_until DATETIME,
  certificate_fingerprint TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (clinic_id) REFERENCES clinic_settings(id)
);
```

---

## 5. Ciclo de Vida e Máquina de Estados da NFS-e

```
┌─────────────────────────────────────────────────────────────┐
│                   Gatilho de Faturamento                    │
│     (Baixa de Sessão / Lote na aba de Notas Fiscais)        │
└──────────────────────────────┬──────────────────────────────┘
                               │
               Modo Ativo?     │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     [Modo MANUAL]                        [Modo AUTOMATED]
  - Abre WhatsApp Contador             - Disparo REST Nuvem Fiscal
  - Status: REQUESTED                  - Status: PROCESSING_GATEWAY
  - Upload Manual do PDF                               │
  - Conclusão via Modal                 ┌──────────────┴──────────────┐
                                        ▼                             ▼
                                 [Autorizado]                   [Rejeitado]
                                 Status: ISSUED               Status: REJECTED
                                 • Salva PDF/XML              • Detalha erro
                                 • Anexa Prontuário           • Botão Reenviar
                                 • Dispara WhatsApp           • Fallback WhatsApp
```

---

## 6. Mudanças no Formato Atual e Telas (UX/UI)

### 6.1. Configurações (`SettingsModule.tsx`)
A aba "Contabilidade" é atualizada para **"Fiscal & Contabilidade"**:
1. **Seletor de Modo Operacional:**
   * **Modo A (Contabilidade Externa):** Mantém o formulário atual (telefone, template de mensagem WhatsApp para o contador parceiro).
   * **Modo B (Emissão Direta NFS-e Premium):**
     * Card com status do módulo (*Ativo / Inativo*).
     * Área para upload do Certificado Digital A1 (`.pfx`) e digitação da senha.
     * Validação instantânea de validade do certificado (com data de expiração).
     * Campos de Inscrição Municipal, Código IBGE da cidade, Alíquota de ISS e Regime Tributário.
     * Botão **"Testar Conexão com a Prefeitura"** (homologação em Sandbox).

### 6.2. Modal de Quitação de Sessão (`RecordPaymentModal`)
* No momento de dar baixa em uma ou mais sessões:
  * Se Modo B estiver ativo: Checkbox `[✓] Emitir NFS-e Oficial Imediatamente (1 Clique)`.
  * Ao salvar o pagamento, um toast/spinner elegante exibe: *"Emitindo NFS-e junto à prefeitura..."*.
  * O comprovante é gerado e o PDF oficial fica disponível instantaneamente.

### 6.3. Modal de Emissão Agrupada (`InvoiceRequestModal.tsx`)
* Usado para agrupar atendimentos do mês ou sessões futuras de reembolso:
  * **Seletor de Tomador:** Alternância inteligente entre **[x] Paciente** ou **[x] Responsável Financeiro** (com CPF e dados fiscais do responsável já preenchidos).
  * **Ação Primária:** Botão **"⚡ Emitir NFS-e Oficial"**, disparando o lote para a Nuvem Fiscal.
  * **Ação Secundária:** Dropdown permitindo *"Enviar Solicitação por WhatsApp"* (caso queira tratar manualmente pontualmente).

### 6.4. Conclusão da Nota (`InvoiceCompleteModal.tsx`)
* Este modal passa a ter atuação seletiva:
  * **Para notas automáticas (`AUTOMATED`):** O modal é **dispensado**. O PDF, XML e número são registrados via API.
  * **Para notas manuais (`MANUAL`):** O modal permanece inalterado, permitindo que a secretária digite o número da nota enviado pelo contador e anexe o arquivo.

### 6.5. Painel de Controle de Notas Fiscais (`FinancialModule.tsx`)
* A aba **NOTAS FISCAIS** ganha suporte visual aos novos status:
  * Badges: `PENDING_DISPATCH`, `REQUESTED`, `PROCESSING_GATEWAY`, `ISSUED`, `REJECTED`, `CANCELED`.
  * Ações na linha da nota:
    * Baixar DANFSE (PDF).
    * Baixar XML Oficial.
    * Enviar ao Paciente via WhatsApp (usando roteamento automático para paciente ou responsável).
    * Cancelar NFS-e (com preenchimento de justificativa exigida pela prefeitura).
    * Ver Detalhes do Erro (em caso de `REJECTED`), com botão de reemissão.

---

## 7. Roteiro de Transição e Próximos Passos

1. **Fase 1 (Estruturação e Contrato de Gateway):**
   * Configuração de credenciais de sandbox no portal da **Nuvem Fiscal**.
   * Criação do serviço `server/fiscalGatewayService.ts` com adaptador de comunicação REST.
2. **Fase 2 (Banco de Dados e Cofre de Segurança):**
   * Migração de banco com as colunas novas em `invoices` e a tabela `clinic_fiscal_credentials`.
   * Criptografia AES-256-GCM para o certificado A1 e senha.
3. **Fase 3 (Telas de Configuração e Teste de Conexão):**
   * Upgrade da aba "Fiscal & Contabilidade" em `SettingsModule.tsx`.
   * Endpoint `POST /api/fiscal/test-connection` para validar credenciais municipais.
4. **Fase 4 (Fluxo de Emissão 1-Clique & Webhook):**
   * Ajuste no modal de baixa financeira e `InvoiceRequestModal.tsx`.
   * Endpoint de Webhook `POST /api/fiscal/webhook` para recepção assíncrona de prefeituras em lote.
   * Vinculação direta em `patient_documents` e disparo via `whatsappRouting.ts`.
5. **Fase 5 (Cancelamento e Homologação):**
   * Funcionalidade de cancelamento formal perante a prefeitura.
   * Validação em ambiente de testes antes da liberação geral para clientes Premium.
