# Especificação Técnica: Roteamento de WhatsApp para Pacientes e Responsáveis

## 1. Contexto e Objetivo

No contexto de atendimento em psicologia clínica (especialmente crianças, adolescentes, idosos assistidos ou pacientes dependentes), as comunicações automatizadas via WhatsApp (confirmação/lembrete de horário de atendimento, demonstrativo de cobrança de honorários com PIX, e envio de comprovante de Nota Fiscal emitida) não devem ser disparadas cegamente para o paciente, mas sim para o **Responsável Legal** ou **Responsável Financeiro**, com linguagem nominal acolhedora e contextualizada (ex: *"Olá, [Nome do Responsável]! Confirmando a sessão de [Nome do Paciente]..."*).

Este documento formaliza a arquitetura, modelo de dados, componentes e regras de negócio para suportar a seleção flexível do destinatário de WhatsApp em todo o sistema Psicogestão.

---

## 2. Resumo do Entendimento (Understanding Summary)

- **Configuração Granular no Perfil do Paciente:**
  - Canal para Agendamentos & Lembretes: `Paciente` ou `Responsável Legal`.
  - Canal para Cobranças & Notas Fiscais: `Paciente`, `Responsável Legal` ou `Responsável Financeiro`.
- **Pré-seleção Inteligente:** Ao cadastrar ou editar um paciente do grupo `Criança` ou `Adolescente`, o sistema sugere automaticamente `Responsável Legal` como padrão. Para adultos, sugere `Paciente`.
- **Substituição Fácil no Momento do Disparo:** Todos os modais de envio (Lembrete na Agenda/Dashboard, Cobrança no BillingsModule, NF no InvoiceCompleteModal) possuem uma barra de seleção rápida com prévia em tempo real.
- **Adaptação Nominal do Texto:** Redação ajustada dinamicamente dependendo do destinatário selecionado, citando o nome do paciente com clareza.
- **Conformidade LGPD & CFP 06/2019:** Mensagens estritamente neutras quanto a dados clínicos ou diagnósticos sensíveis.
- **Não-Escopo:** Não utiliza APIs externas pagas em background; mantém disparo via WhatsApp Web / App desktop com controle e confirmação visual do profissional.

---

## 3. Registro de Decisões (Decision Log)

| ID | Decisão | Alternativas Consideradas | Justificativa |
| :--- | :--- | :--- | :--- |
| **DEC-01** | Preferência no cadastro com alternador rápido nos modais de envio | Regra fixa por idade vs. Escolha manual em todo envio | Dá velocidade no dia a dia com automação padrão, sem retirar a flexibilidade do profissional para casos específicos. |
| **DEC-02** | Adaptação inteligente e dinâmica do texto | Mensagem neutra genérica vs. Templates manuais separados | Garante tom empático, profissional e acolhedor sem trabalho braçal de redigitação pelo psicólogo. |
| **DEC-03** | Canais separados para Agendamentos vs. Financeiro/NF | Canal geral único | Cobre com perfeição casos reais onde o paciente (ex: adolescente) cuida dos próprios horários, mas a mãe/pai ou terceiro paga as sessões. |
| **DEC-04** | Persistência em campo JSON (`whatsapp_routing_json`) | Novas colunas relacionais normalizadas | Garante retrocompatibilidade total com a base SQLite sem risco de quebra e suporte imediato a `null` para cadastros antigos. |
| **DEC-05** | Fallback transparente | Bloqueio de envio em dados incompletos | Se faltar o telefone do responsável, o sistema alerta visualmente e oferece o telefone do paciente como contingência imediata. |

---

## 4. Premissas e Requisitos Não-Funcionais

1. **Performance:** A troca de destinatário no modal recalcula o texto da mensagem e a URL do WhatsApp de forma 100% síncrona no cliente (0 ms de latência percebida).
2. **Segurança & Auditoria:** Disparos de lembretes e cobranças registram no log de auditoria quem foi o destinatário nominal da ação.
3. **Higienização de Telefones:** Sanitização padronizada com DDI 55 do Brasil (`55 + DDD + 9 dígitos`), suportando formatos `(XX) 9XXXX-XXXX`, `+55...` ou apenas números.
4. **Resiliência da API:** Schemas Zod com `.nullish()` para aceitar objetos parciais ou nulos sem falhas de validação.

---

## 5. Modelo de Dados & Tipagens

### 5.1 `src/types.ts`
```typescript
export type WhatsAppAppointmentChannel = 'PATIENT' | 'GUARDIAN';
export type WhatsAppFinancialChannel = 'PATIENT' | 'GUARDIAN' | 'FINANCIAL_RESPONSIBLE';

export interface WhatsAppRoutingConfig {
  appointmentChannel: WhatsAppAppointmentChannel;
  financialChannel: WhatsAppFinancialChannel;
}

// Extensão da interface Patient
export interface Patient {
  // ... campos existentes ...
  whatsapp_routing?: WhatsAppRoutingConfig;
}
```

### 5.2 Banco de Dados SQLite (`server/db.ts`)
- Campo `whatsapp_routing_json TEXT` na tabela `patients`.
- Desserialização automática no backend via helper `parsePatientRow()`.

---

## 6. Componentes & Utilitários da Solução

### 6.1 Helper Centralizado: `src/utils/whatsappRouting.ts`
Funções utilitárias puras:
- `cleanWhatsAppPhone(rawPhone: string): string`
- `resolveRecipient(patient: Patient, purpose: 'APPOINTMENT' | 'BILLING' | 'INVOICE'): ResolvedWhatsAppRecipient`
- `buildAppointmentMessage({ patientName, recipientName, isGuardian, psychName, dateStr, timeStr, modality }): string`
- `buildBillingMessage({ patientName, recipientName, isGuardian, tone, ... }): string`
- `buildInvoiceMessage({ patientName, recipientName, isGuardian, invoiceNumber, issuedAt, totalAmount }): string`

### 6.2 Componente Seletor: `src/components/whatsapp/WhatsAppRecipientSelector.tsx`
Componente visual exibido nos modais de envio:
- Mostra pílulas selecionáveis: `[ Paciente ]`, `[ Responsável Legal ]` e `[ Responsável Financeiro ]`.
- Identifica nome do contato, parentesco e telefone formatado.
- Alerta visual caso o contato selecionado não tenha telefone válido cadastrado.

### 6.3 Formulários de Cadastro & Perfil
- `src/components/PatientFormModal.tsx`:
  - Seção com ícone de WhatsApp para configurar os canais de agendamento e financeiro.
  - Auto-preenchimento para "Responsável Legal" ao selecionar `Criança` ou `Adolescente`.
- `src/components/patients/PatientProfileTab.tsx`:
  - Seção de canais de comunicação com edição e salvamento contínuo.

### 6.4 Modais de Envio Atualizados
- `src/components/BillingsModule.tsx`:
  - Incorpora o `WhatsAppRecipientSelector` acima da prévia.
  - Ajusta o texto gerado e o link `https://api.whatsapp.com/send?phone=...`.
- `src/components/InvoiceCompleteModal.tsx`:
  - Adiciona o `WhatsAppRecipientSelector` e a adaptação do texto para o responsável.
- `server/routes.ts` & `src/components/Dashboard.tsx` / `Agenda.tsx`:
  - `POST /sessions/:id/whatsapp-reminder` aceita `recipientOverride` e gera a mensagem dirigida ao responsável quando aplicável.
- `src/components/patients/PatientHubView.tsx` & `PatientOverviewTab.tsx`:
  - Botão de WhatsApp no perfil com menu rápido para Paciente vs. Responsável.

---

## 7. Casos de Borda e Mitigações

1. **Paciente antigo sem `whatsapp_routing` cadastrado:**
   - Fallback automático: se `group === 'Criança' || group === 'Adolescente'` e existir `guardian.phone`, utiliza `GUARDIAN`. Caso contrário, utiliza `PATIENT`.
2. **Responsável selecionado, mas sem telefone:**
   - Alerta visual no componente e fallback imediato com 1 clique para o telefone do paciente ou edição rápida.
3. **Paciente Adulto sem responsável:**
   - O seletor nos modais fica simplificado e não introduz ruído visual para atendimentos rotineiros de adultos.
