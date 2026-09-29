# Especificação de Design: Avaliação Neuropsicológica e Gestão de Laudos Clínicos

**Data:** 14/09/2026  
**Status:** Validado via Brainstorming com o Usuário  
**Referência Normativa:** Resoluções CFP 01/2009, 06/2019 e LGPD (Lei 13.709/2018)  
**Módulos Impactados:** Prontuário do Paciente, Agenda Inteligente, Módulo Financeiro & Carnê-Leão, Documentação Clínica  

---

## 1. Contexto & Propósito

No atendimento clínico psicológico e neuropsicológico, a **Avaliação Neuropsicológica** possui natureza comercial, operacional e clínica substancialmente diferente do atendimento de psicoterapia tradicional:
1. **Natureza Comercial:** O serviço é contratado por um **valor total fechado (pacote)**, com flexibilidade de negociação (à vista ou parcelamento sob medida), e não por valor fixo por sessão avulsa.
2. **Dinâmica Clínica das Sessões:** A aplicação das baterias de testes (atenção, funções executivas, QI, memória, linguagem, personalidade, escalas) exige um número variável de sessões conforme a queixa, ritmo do paciente e fadiga cognitiva (ex: 5 a 10 sessões).
3. **Convivência com Psicoterapia:** O mesmo paciente pode realizar concomitantemente atendimentos de psicoterapia regular (cobrados por sessão) enquanto realiza a avaliação neuropsicológica.
4. **Demandas com Convênios & Planos de Saúde:** Famílias solicitam reembolsos parciais mês a mês (exigindo recibo por parcela paga) ou reembolso global no encerramento (com o laudo finalizado).

---

## 2. Understanding Lock (Alinhamento Consolidado)

- **O que será construído:** Uma entidade e motor de primeira classe (`neuropsych_evaluations`) para gestão de Avaliações Neuropsicológicas e Laudos, com gerador flexível de parcelas, agendamento de sessões vinculadas sem cobrança avulsa duplicada, emissão de recibos multi-modo e acompanhamento no prontuário até a entrega da devolutiva.
- **Para quem é:** Para psicólogas/neuropsicólogas clínicas (autonomia clínica e de investigação), secretárias (clareza visual de agenda e parcelas sem acesso a sigilo clínico) e pacientes/famílias (flexibilidade financeira e recibos para plano de saúde).
- **Restrições:** Resoluções CFP 01/2009 (sigilo de anotações), CFP 06/2019 (seções obrigatórias do Laudo Psicológico) e LGPD (criptografia AES-256-GCM e trilha de auditoria).
- **Não-Escopo:** Correção informatizada de testes psicométricos comerciais proprietários (substituição de plataformas de testes); integração automatizada direta com webservices de NFS-e municipal (prefeitura API).

---

## 3. Log de Decisões (Decision Log)

| # | Decisão | Alternativas Consideradas | Motivo da Escolha |
| :-: | :--- | :--- | :--- |
| **1** | **Processo com Ciclo de Vida Próprio** | Alteração no tipo de plano do paciente; Controle avulso no financeiro | Dá integridade ao ciclo de investigação clínica, amarrando financeiro, sessões e documento final. |
| **2** | **Sessões Flexíveis com Tipo Explicito** | Pacote com saldo rígido; Vinculação automática de todas as sessões | Permite agendar quantas sessões forem clinicamente necessárias e suporta psicoterapia regular concomitante. |
| **3** | **Gerador Flexível de Parcelas** | Parcelamento fixo de 30 em 30 dias; Parcelas atreladas a marcos clínicos | Concede liberdade comercial total para negociar entradas maiores, datas de pagamento personalizadas e meios variados. |
| **4** | **Emissão Multi-Modo de Recibos/NF** | Apenas NF consolidada única; Apenas recibos por parcela | Atende com perfeição tanto planos de saúde que exigem recibo mensal para reembolso quanto os que exigem recibo global com o Laudo. |
| **5** | **Painel Integrado no Prontuário** | Módulo separado fora da ficha; Apenas pasta em documentos | Mantém a neuropsicóloga no centro do cuidado do paciente com linha do tempo de testes e rascunho contínuo do laudo. |
| **6** | **Arquitetura Relacional Híbrida** | Módulo isolado com sub-sistemas próprios; Metadados JSON soltos | Reaproveita 100% da robustez de Agenda, Financeiro e Prontuário sem duplicar código nem criar silos. |

---

## 4. Especificação Técnica e Arquitetura

### A. Modelo do Banco de Dados (SQLite)

```sql
-- 1. Nova Tabela de Avaliações Neuropsicológicas
CREATE TABLE IF NOT EXISTS neuropsych_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  psychologist_id INTEGER NOT NULL,
  title TEXT NOT NULL,                                       -- Ex: "Investigação Neuropsicológica - TDAH / Funções Executivas"
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' 
    CHECK(status IN ('IN_PROGRESS', 'AWAITING_DEVOLUTIVA', 'COMPLETED', 'CANCELED')),
  estimated_sessions INTEGER NOT NULL DEFAULT 6,             -- Previsão inicial flexível
  total_price REAL NOT NULL,                                 -- Valor fechado do pacote (ex: 3500.00)
  payment_mode TEXT NOT NULL DEFAULT 'PARCELADO'
    CHECK(payment_mode IN ('A_VISTA', 'PARCELADO')),
  hypothesis_diagnosis TEXT,                                 -- Hipótese clínica inicial
  notes TEXT,                                                -- Observações comerciais / enquadramento
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (psychologist_id) REFERENCES users(id)
);

-- 2. Alterações Retrocompatíveis nas Tabelas Existentes
ALTER TABLE sessions ADD COLUMN evaluation_id INTEGER REFERENCES neuropsych_evaluations(id);
ALTER TABLE sessions ADD COLUMN session_type TEXT DEFAULT 'PSYCHOTHERAPY' 
  CHECK(session_type IN ('PSYCHOTHERAPY', 'EVALUATION'));

ALTER TABLE financial_transactions ADD COLUMN evaluation_id INTEGER REFERENCES neuropsych_evaluations(id);
ALTER TABLE financial_transactions ADD COLUMN installment_number INTEGER;
ALTER TABLE financial_transactions ADD COLUMN total_installments INTEGER;
ALTER TABLE financial_transactions ADD COLUMN invoice_status TEXT DEFAULT 'NOT_ISSUED' 
  CHECK(invoice_status IN ('NOT_ISSUED', 'ISSUED_INSTALLMENT', 'ISSUED_CONSOLIDATED'));

ALTER TABLE patient_documents ADD COLUMN evaluation_id INTEGER REFERENCES neuropsych_evaluations(id);
```

---

### B. Componentes de Interface (UI/UX)

1. **Modal de Contratação / Abertura de Avaliação (`NewEvaluationModal.tsx`):**
   - Campo para Demanda/Título da investigação;
   - Valor Total Fechado (R$);
   - Condição de Pagamento (À vista ou *N* parcelas);
   - Tabela interativa com linha para cada parcela permitindo editar valor, data e método;
   - Botão "Iniciar Processo & Gerar Parcelas".

2. **Painel de Acompanhamento no Prontuário (`PatientEvaluationCard.tsx`):**
   - Exibido no topo da aba clínica do paciente quando houver avaliação em andamento;
   - Indicador de progresso: *"X sessões realizadas • Estimativa de Y"*;
   - Status financeiro: *"R$ X de R$ Y quitados (Z de W parcelas)"*;
   - Lista de testes e instrumentos administrados;
   - Acesso com 1 clique ao rascunho do Laudo;
   - Ação "Concluir Avaliação & Agendar Devolutiva".

3. **Seletor de Tipo de Sessão na Agenda (`AppointmentModal.tsx`):**
   - Seletor evidente:
     - `Avaliação Neuropsicológica (Pacote)` -> Valor R$ 0,00 na sessão, badge lilás com ícone de cérebro `Brain`, contador de sessões;
     - `Psicoterapia Regular` -> Valor padrão do paciente, faturamento avulso normal.

4. **Gerenciador de Recibos para Convênio (`EvaluationInvoicingModal.tsx`):**
   - Lista das parcelas quitadas com botão *"Emitir Recibo da Parcela"*;
   - Botão de destaque *"Emitir Recibo/Declaração Consolidada Total"* (normal ou antecipada);
   - Download de PDF timbrado, com CRP da profissional, dados do paciente e hash de autenticidade.

---

## 5. Segurança, LGPD & Normativas CFP

1. **CFP 01/2009 e 06/2019 (Sigilo Absoluto):**
   - Apenas profissionais com perfil de Psicólogo ou Administrador têm acesso aos testes, hipóteses e texto do Laudo.
   - O perfil de Secretária visualiza apenas os agendamentos na Agenda e as parcelas pendentes no Financeiro.
2. **Criptografia AES-256-GCM:**
   - O conteúdo do Laudo Neuropsicológico e das anotações de evolução é criptografado em repouso no banco SQLite.
3. **Imutabilidade e Integridade:**
   - Ao finalizar a avaliação, o Laudo recebe um hash criptográfico SHA-256 definitivo, impedindo alterações posteriores sem registro de auditoria.
