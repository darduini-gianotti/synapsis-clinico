# Design — Synapsis IA: Videochamada Integrada + Resumo de Sessão com IA
**Módulo Premium | Roadmap: 3–6 meses | Versão: 1.0 | Data: 2026-09-20**

---

## 1. Understanding Summary

| Dimensão | Definição |
|---|---|
| **O que é** | Módulo "Synapsis IA" — sala de videochamada integrada + assistente de IA que gera rascunho automático de evolução clínica ao final da sessão |
| **Por que existe** | Eliminar o atrito da escrita pós-sessão; posicionar o Synapsis como produto diferenciado frente a Plenne, Psidigital, Sentir IA |
| **Para quem** | Psicólogos que já usam o Synapsis e realizam atendimentos online — plano Premium |
| **Papel da IA** | Copiloto exclusivo — gera rascunho, **nunca assina**; psicólogo obrigatoriamente revisa e executa a assinatura SHA-256 |
| **Privacidade** | Transcrição descartada imediatamente após processamento — sem armazenamento de áudio nem transcrição em servidor |
| **Não-metas** | IA não diagnostica, não participa da sessão, não substitui julgamento clínico, não é chatbot terapêutico |
| **Prazo** | Roadmap de 3 a 6 meses como diferencial competitivo urgente |

---

## 2. Premissas Assumidas

- 🔵 O paciente deve ser informado e dar consentimento explícito antes da sessão via TCLE atualizado
- 🔵 A API de transcrição/IA usada será de um provedor com contrato adequado à LGPD (sem treinamento com dados de clientes)
- 🔵 O custo de API de IA será absorvido na mensalidade do plano Premium
- 🔵 Fase 1 suporta apenas sessões onde o psicólogo dita — sem captura de voz do paciente
- 🔵 Fase 2 (WebRTC) é opt-in por sessão, requerendo confirmação no checklist do psicólogo

---

## 3. Contexto de Mercado

### Tendência Identificada
Plataformas como **Plenne** ([plenne.com.br](https://plenne.com.br)), **Psidigital**, **Sentir IA**, **Dr. Assistente** e **AINuma** já oferecem integração de videochamada com geração automática de rascunho de prontuário via IA. A tendência é consolidada no mercado brasileiro de 2025/2026.

### Posicionamento
O Synapsis já possui vantagem única em compliance (AES-256-GCM + SHA-256 + Zero-Knowledge RBAC). O módulo de IA preenche o único gap que os concorrentes usam como diferencial — e ainda com nível superior de segurança jurídica.

### Regulatório
- **Resolução CFP nº 09/2024** — regula atendimento via TDICs; exige avaliação técnica do profissional por caso
- **Posicionamento CFP (2025)** — IA é ferramenta de apoio; responsabilidade clínica é intransferível
- **LGPD** — exige transparência, consentimento e privacidade por design; dados de saúde são categoria especial sensível
- **Não há vedação expressa** ao uso de IA como copiloto de documentação, desde que o profissional revise e assine

---

## 4. Abordagem Escolhida — Implementação em 2 Fases

### Fase 1: MVP — Ditado Inteligente + Upload de Áudio (Meses 1–3)

**Fluxo:**
```
[Prontuário → Nova Evolução]
    ↓
[Botão ✨ "Gerar com IA" — visível apenas no plano Premium]
    ↓
[Modal: Ditado Inteligente]
  • Psicólogo fala livremente sobre a sessão (sem mencionar dados identificadores do paciente)
  • OU faz upload de arquivo de áudio (.mp3/.m4a/.ogg)
    ↓
[Pipeline Backend]
  1. Áudio recebido via HTTPS multipart — nunca salvo em disco
  2. Transcrição: Gemini Flash (primário) / Whisper (fallback)
  3. Estruturação: Gemini Pro → 5 campos das seções CFP
  4. Áudio e transcrição descartados imediatamente
    ↓
[Campos do prontuário pré-preenchidos como 🤖 RASCUNHO IA]
  • Label permanente até assinatura
  • SHA-256 bloqueado até psicólogo confirmar revisão
  • Psicólogo edita, revisa e assina normalmente
```

### Fase 2: Sala WebRTC Nativa (Meses 4–6)

**Stack:** LiveKit (SDK React + possibilidade de self-hosted)

**Fluxo adicional:**
```
[Agenda → Sessão Online → Ativar Synapsis IA]
    ↓
[Hard gate: checklist de consentimento — registrado no audit log LGPD]
    ↓
[Sala WebRTC nativa no browser]
  • Link seguro para o paciente (JWT com expiração de 2h, sem necessidade de cadastro)
  • Áudio criptografado em trânsito (TLS 1.3)
    ↓
[Psicólogo encerra sessão → pipeline automático dispara]
  → Mesmo pipeline da Fase 1
  → Rascunho gerado e disponível no prontuário
```

---

## 5. Arquitetura Técnica

### Frontend
- `MediaRecorder API` (nativo no browser) para captura de áudio do ditado
- SDK LiveKit React para sala WebRTC (Fase 2)
- Áudio mantido em memória — nunca escrito em disco local

### Backend (server.ts existente)
```
POST /api/ai/transcribe-and-draft
  → Recebe: áudio (multipart/form-data) + session_id + patient_id (sem PII clínico)
  → Processa: transcrição → estruturação CFP
  → Retorna: JSON com campos pré-preenchidos
  → Registra: audit_log { action: 'ai_draft_generated', crp, ts, source }
  → Descarta: nenhum dado clínico salvo nesta etapa
```

### Banco de Dados
Apenas 2 campos adicionais na tabela de evoluções existente:
```sql
ALTER TABLE evolutions ADD COLUMN ai_draft_used BOOLEAN DEFAULT FALSE;
ALTER TABLE evolutions ADD COLUMN ai_draft_source TEXT;
-- valores: 'dictation' | 'upload' | 'webrtc' | NULL (manual)
```

### APIs Externas
| Serviço | Uso | Contrato Obrigatório |
|---|---|---|
| Google Gemini Flash | Transcrição de áudio | Verificar DPA (Data Processing Agreement) |
| Google Gemini Pro | Estruturação CFP | Idem |
| OpenAI Whisper (fallback) | Transcrição | OpenAI Business — sem uso de dados para treinamento |
| LiveKit Cloud (Fase 2) | Infraestrutura WebRTC | Verificar DPA + retenção de logs de mídia |

---

## 6. Controles de Segurança e Conformidade

| Risco | Nível | Mitigação |
|---|---|---|
| Áudio capturado sem consentimento | 🔴 Alto | Hard gate de confirmação + registro no audit log LGPD |
| Transcrição retida em provedor externo | 🔴 Alto | Contratos com cláusula "no data retention" |
| IA treinando com dados de pacientes | 🔴 Alto | APIs Business/Enterprise que vedam uso de dados de clientes |
| Rascunho publicado sem revisão clínica | 🔴 Alto | SHA-256 bloqueado até confirmação de revisão; campo readonly |
| Vazamento do áudio em trânsito | 🟡 Médio | TLS 1.3 obrigatório + descarte em memória |
| Re-identificação via transcrição | 🟡 Médio | Orientação no UI: "não mencione nome/CPF no ditado" |
| Custo de API inesperado | 🟡 Médio | Rate limit por clínica/mês + alertas de consumo no admin |
| Resistência de pacientes | 🟡 Médio | Opt-out preservado sem prejuízo ao atendimento; TCLE claro |
| Impacto terapêutico | 🟢 Baixo | Fase 1 não afeta a sessão; Fase 2 é opt-in por sessão |

---

## 7. UX — Elementos de Interface

### Badge de Rascunho (obrigatório)
```
┌─────────────────────────────────────────────────────┐
│  🤖 RASCUNHO GERADO PELA IA — Revisão obrigatória   │
│  Este conteúdo foi gerado automaticamente e pode     │
│  conter imprecisões. Revise e edite antes de assinar.│
└─────────────────────────────────────────────────────┘
```

### Checklist de Consentimento (Fase 2 — antes de ativar IA na sessão)
```
✅ O paciente recebeu e assinou o TCLE com cláusula de uso de IA?
✅ O paciente foi informado que o áudio será processado e descartado?
✅ O paciente tem direito de recusar sem prejuízo ao atendimento?

[❌ Iniciar sem IA]    [✅ Confirmo todos — Ativar IA]
```

### Ativação por Plano
- Botão `✨ Gerar com IA` visível apenas para `synapsis_ai_enabled = true`
- Para usuários sem o plano: botão oculto (sem mensagens de upsell intrusivas na sessão clínica)

---

## 8. Modelo de TCLE — Cláusula Adicional Sugerida

> **Cláusula X — Uso de Tecnologia de Inteligência Artificial**
>
> O(a) paciente declara estar ciente de que o(a) profissional responsável pelo seu atendimento poderá, opcionalmente, utilizar um assistente de Inteligência Artificial (IA) como ferramenta de apoio à documentação clínica. Nesse contexto:
>
> a) O áudio da sessão ou o relato do profissional sobre a sessão poderá ser processado por sistemas de transcrição automatizada para fins exclusivos de geração de rascunho de prontuário;
> b) O áudio e a transcrição são descartados imediatamente após o processamento, não sendo armazenados em nenhum servidor;
> c) O conteúdo gerado pela IA é sempre revisado e validado pelo profissional antes de ser incorporado ao prontuário;
> d) O(a) paciente tem o direito de recusar o uso desta tecnologia a qualquer momento, sem qualquer prejuízo à continuidade do atendimento.

---

## 9. Prós e Contras Consolidados

### ✅ Prós
- Redução estimada de 30–45 min/dia de trabalho administrativo para psicólogos com agenda cheia
- Diferencial competitivo direto frente a Plenne, Psidigital, Sentir IA
- Nova camada de receita (plano Premium) sem canibalizar planos existentes
- Compliance superior ao dos concorrentes: único com AES-256 + SHA-256 + IA como copiloto auditado
- Fase 1 de MVP sem captura de voz do paciente — risco regulatório mínimo

### ⚠️ Contras / Riscos
- Custo de API de IA (estimado \$2–4 USD/psicólogo/mês) precisa estar no cálculo do plano Premium
- CFP pode emitir novas resoluções específicas sobre IA — monitoramento contínuo necessário
- Risco de "preguiça clínica" — psicólogos aprovando rascunhos sem revisão crítica (mitigado pelo design)
- Fase 2 exige infraestrutura WebRTC com custo operacional adicional

---

## 10. Decision Log

| # | Decisão | Alternativas Consideradas | Razão da Escolha |
|---|---|---|---|
| 1 | IA apenas como rascunho — nunca assina | IA com aprovação 1 clique; transcrição bruta | Responsabilidade clínica intransferível (CFP); risco ético e jurídico |
| 2 | Transcrição descartada imediatamente | Armazenar por 24h; guardar como anexo | Privacidade máxima; elimina cadeia de custódia e risco de re-identificação |
| 3 | Módulo Premium separado | Incluído em todos os planos | Preserva posicionamento dos planos existentes; cobre custo de API |
| 4 | Implementação em 2 fases | Fase 2 direto; apenas ditado | Valida pipeline com risco mínimo; aprendizado antes de escalar WebRTC |
| 5 | Ditado pelo psicólogo (sem captura de paciente) | Gravação da sessão inteira | Elimina 80% dos problemas de consentimento e regulatório na Fase 1 |
| 6 | LiveKit como infra WebRTC (Fase 2) | Daily.co; Twilio Video; Jitsi | Open-source, SDK React pronto, self-hostável, custo competitivo |
| 7 | Gemini Flash/Pro como LLM principal | OpenAI GPT-4o; Claude | Gemini API Key já existe no projeto (.env); latência e custo otimizados |

---

## 11. Roadmap

```
MÊS 1-2: MVP — Ditado Inteligente
  ├── MediaRecorder API no browser
  ├── Endpoint POST /api/ai/transcribe-and-draft
  ├── Integração Gemini Flash (transcrição) + Pro (estruturação CFP)
  ├── UI de rascunho com badge 🤖 obrigatório
  ├── 2 campos no banco (ai_draft_used, ai_draft_source)
  ├── Audit log de geração de rascunho IA
  └── Cláusula de TCLE disponibilizada aos clientes

MÊS 3: Upload de Áudio + Refinamentos
  ├── Upload .mp3 / .m4a / .ogg
  ├── Seletor de abordagem clínica (TCC, Psicanálise, Humanista...)
  │   → Ajusta o prompt de estruturação do LLM
  ├── Painel de consumo de IA por clínica (admin)
  └── Coleta de feedback dos primeiros usuários Premium

MÊS 4-6: Sala WebRTC Nativa
  ├── Integração LiveKit SDK React
  ├── Link seguro para paciente (JWT com expiração de 2h)
  ├── Hard gate de consentimento + registro em audit log LGPD
  └── Pipeline automático ao encerrar sessão WebRTC
```

---

## 12. Critérios de Aceitação

### Fase 1 — MVP
- [ ] Ditado de 2 min gera rascunho nos 5 campos CFP em menos de 30 segundos
- [ ] Nenhum dado de áudio ou transcrição persiste após retorno da API
- [ ] Badge `🤖 RASCUNHO IA` visível e impossível de ocultar antes da assinatura
- [ ] SHA-256 só é gerado após o psicólogo confirmar a revisão
- [ ] Audit log registra `ai_draft_generated` com CRP, timestamp e source
- [ ] Botão de IA invisível para usuários sem plano Premium

### Fase 2 — WebRTC
- [ ] Paciente acessa sala via link sem necessidade de cadastro
- [ ] Checklist de consentimento bloqueia ativação da IA sem confirmação
- [ ] Confirmação de consentimento registrada no audit log LGPD
- [ ] Áudio encaminhado ao pipeline sem persistência intermediária
- [ ] Sala funciona em conexões de 5 Mbps ou mais (qualidade HD mínima)

---

*Documento gerado via sessão de brainstorming estruturado — Synapsis/PsicoGestão — 2026-09-20*
