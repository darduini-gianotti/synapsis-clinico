# Especificação Técnica & Design de Produto: Synapsis Academy

**Status:** Validado e Aprovado  
**Versão:** 1.0.0  
**Data:** 17 de Setembro de 2026  
**Autor:** Antigravity (Design Facilitator) & Gestão Synapsis  

---

## 1. Visão Geral & Resumo de Entendimento (Understanding Summary)

A **Synapsis Academy** é uma plataforma nativa de capacitação e onboarding para o **Synapsis Clínico**, concebida sob o paradigma *"Aprenda enquanto faz"* (*Hands-on Interactive Tours*).

* **Objetivo:** Substituir tutoriais passivos em vídeo (que exigem pausar, alternar janelas e tentar replicar sem segurança) por roteiros guiados diretamente sobre as telas do sistema.
* **Público-Alvo:** Novos colaboradores (recepcionistas, secretárias, psicólogos clínicos e gestores) e colaboradores veteranos que necessitem de reciclagem ou consulta rápida a rotinas complexas.
* **Problema Resolvido:** Redução drástica da sobrecarga de treinamento e do tempo de onboarding gerados pela rotatividade de funcionários, garantindo padronização operacional sem risco de erros em produção.
* **Ambiente Simulado (Sandbox Virtual):** Ao iniciar um procedimento de treinamento, a aplicação ativa um ambiente virtual isolado em memória com dados fictícios de uma "Clínica Modelo". Todas as ações críticas (mensagens WhatsApp, emissão de NFSe, gravação de prontuário) são interceptadas, garantindo **risco zero** a dados reais, total conformidade com a LGPD e a Resolução CFP 06/2019.
* **Interatividade com Foco Visual (Spotlight):** A tela projeta uma máscara escura com recorte iluminado no botão ou campo exato onde o usuário deve agir, avançando dinamicamente ao detectar o clique ou digitação correta, mantendo opção de *"Pular passo"* como fallback.
* **Trilhas & Repetições:** Os procedimentos são agrupados em trilhas por perfil de atuação. O colaborador pode repetir qualquer treinamento ilimitadas vezes para fixação.
* **Contador de Práticas & Visão do Gestor:** O progresso é registrado com percentual de conclusão, data da última realização e **contador de repetições**, permitindo ao Administrador acompanhar o engajamento e maturidade da equipe no módulo de Colaboradores.

---

## 2. Requisitos Não-Funcionais & Premissas (Assumptions)

1. **Segurança & Conformidade (LGPD & CFP 06/2019):** O Sandbox é estritamente isolado. Sob nenhuma circunstância requisições no modo Academy disparam chamadas a gateways reais (`WhatsApp Evolution/Baileys`, `Asaas`, `Focus NFe`) ou gravam no banco SQLite de produção.
2. **Performance:** O carregamento da Academy e das fixtures fictícias em memória ocorre de forma instantânea (< 150ms), sem chamadas pesadas de rede nem bibliotecas volumosas.
3. **Resiliência de Interface:** Os elementos de tela são referenciados via atributos semânticos estáveis (`data-tour="..."`), evitando que mudanças visuais de CSS quebrem os tutoriais.
4. **Persistência Leve:** O progresso é persistido no banco de dados SQLite associado ao ID do colaborador de forma relacional ou JSON compacto.

---

## 3. Registro de Decisões (Decision Log)

| # | Decisão | Alternativas Consideradas | Motivo da Escolha |
|---|---|---|---|
| **D1** | **Catálogo Nativo Oficial** de trilhas prontas de fábrica por perfil profissional. | Construtor visual (*drag-and-drop tour builder*) para a clínica criar do zero. | Máxima estabilidade, sem esforço para a clínica e sem complexidade de engenharia de um editor visual genérico. |
| **D2** | **Sandbox Virtual em Memória** com interceptação transparente de chamadas. | Instanciar bancos SQLite temporários paralelos no servidor Express. | Zero risco de vazamento de dados, menor consumo de memória no servidor e velocidade instantânea. |
| **D3** | **Hands-on Estrito com Fallback de Pular** (Spotlight aguarda a interação correta). | (a) 100% rígido sem pular; (b) Apenas balões informativos passivos. | Garante o aprendizado muscular/prático sem gerar frustração caso o usuário deseje apenas revisar um fluxo. |
| **D4** | **Visão do Colaborador + Painel do Gestor com Contador de Repetições**. | Apenas visão individual do colaborador sem métricas para a clínica. | Dá transparência à gestão sobre quem está capacitado e mensura a repetição/prática dos colaboradores. |

---

## 4. Arquitetura do Sistema

```
                                  ┌─────────────────────────────────────────┐
                                  │          USUÁRIO EM TREINAMENTO         │
                                  └────────────────────┬────────────────────┘
                                                       │
                                            Acessa a Synapsis Academy
                                                       │
                                                       ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       ACADEMY RUNTIME LAYER                                       │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                   │
│   ┌───────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐   │
│   │      AcademyContext       │    │   TourSpotlightOverlay   │    │    VirtualSandboxStore   │   │
│   │ - isSandboxActive: boolean│    │ - Máscara escura SVG     │    │ - Pacientes Fictícios    │   │
│   │ - activeTourId: string    │    │ - Anel luminoso pulsante │    │ - Faturas Demo p/ Wpp    │   │
│   │ - activeStepIndex: number │    │ - Balão com instruções   │    │ - Agenda Modelo          │   │
│   │ - advanceStep()           │    │ - [Pular] [Encerrar]     │    │ - Reset instantâneo      │   │
│   └─────────────┬─────────────┘    └────────────┬─────────────┘    └────────────┬─────────────┘   │
│                 │                               │                               │                 │
│                 ▼                               ▼                               ▼                 │
│   ┌───────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │                                INTERCEPTADOR DE AÇÕES & APIS                              │   │
│   │  • WhatsApp: Simula envio em lote com barra animada e confete (zero chamadas externas)    │   │
│   │  • Financeiro/NFe: Gera espelho fictício em PDF com marca d'água "SIMULAÇÃO ACADEMY"     │   │
│   │  • Prontuário CFP: Simula assinatura eletrônica e salva no estado temporário local        │   │
│   └───────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                   │
└──────────────────────────────────────────────┬────────────────────────────────────────────────────┘
                                               │
                         Progresso Registrado  │ (apenas ao concluir procedimento)
                                               ▼
                              ┌───────────────────────────────────┐
                              │    SQLite: user_academy_progress  │
                              │  - userId, tourId, completedCount │
                              │  - lastCompletedAt, status        │
                              └───────────────────────────────────┘
```

---

## 5. Trilhas e Procedimentos da Versão 1 (Catálogo Oficial)

### 🏥 Trilha 1: Recepção & Atendimento ao Paciente
* **P1. Agendamento Inteligente:**
  * *Objetivo:* Ensinar a agendar uma primeira consulta, configurar periodicidade semanal e selecionar a sala correta na Agenda Inteligente.
  * *Passos:* Clique no botão "Novo Agendamento" -> Selecionar paciente fictício -> Definir horário -> Verificar ausência de conflitos -> Salvar.
* **P2. Torre de Recepção & Painel TV:**
  * *Objetivo:* Operar o fluxo de chegada do paciente e chamada sonora para a sala de espera.
  * *Passos:* Acessar aba "Torre de Recepção" -> Localizar paciente na lista do dia -> Clicar em "Check-in Realizado" -> Acionar "Chamar Paciente (TV)".
* **P3. Confirmações Ativas:**
  * *Objetivo:* Enviar mensagens automáticas de confirmação para a agenda do dia seguinte.

### 🧠 Trilha 2: Prática Clínica (Psicólogo)
* **P1. Navegação no Prontuário CFP 06/2019:**
  * *Objetivo:* Localizar paciente, consultar anamnese e histórico de sessões.
* **P2. Registro de Nova Evolução Clínica:**
  * *Objetivo:* Redigir e assinar evolução clínica em conformidade com o Conselho Federal de Psicologia.
  * *Passos:* Acessar aba "Pacientes" -> Abrir ficha do paciente de teste -> Clicar em "Nova Evolução" -> Preencher descrição -> Concluir com criptografia simulada.
* **P3. Aplicação de Escalas Psicométricas (PHQ-9 / GAD-7):**
  * *Objetivo:* Aplicar escala rastreadora de depressão/ansiedade e interpretar o escore gerado.

### 💰 Trilha 3: Faturamento & Cobrança
* **P1. Verificação de Inadimplência e Cobrança via WhatsApp em Lote:**
  * *Objetivo:* Filtrar honorários em aberto e executar o disparo simulado em lote para os responsáveis.
  * *Passos:* Ir para Financeiro > Cobranças -> Filtrar status "Em Aberto" -> Selecionar todos os itens da lista -> Clicar em "Cobrança via WhatsApp em Lote" -> Revisar mensagens no modal -> Clicar em "Disparar Cobranças" -> Observar simulação de envio com sucesso.
* **P2. Emissão de Recibo / Nota Fiscal de Serviço:**
  * *Objetivo:* Registrar baixa de pagamento e emitir documento fiscal demonstrativo.

---

## 6. Modelo de Dados para Acompanhamento

No banco SQLite, adiciona-se uma tabela simples e resiliente:

```sql
CREATE TABLE IF NOT EXISTS user_academy_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tour_id TEXT NOT NULL,                -- Ex: 'tour-whatsapp-batch', 'tour-new-evolution'
  category TEXT NOT NULL,               -- 'reception' | 'clinical' | 'financial'
  completed_count INTEGER DEFAULT 1,    -- Número de vezes que o colaborador praticou
  status TEXT DEFAULT 'COMPLETED',      -- 'IN_PROGRESS' | 'COMPLETED'
  last_completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, tour_id)
);
```

### Visualização pelo Gestor (Módulo Colaboradores)
* **Coluna "Status Academy":** Badge com percentual geral (ex: `85% Capacitado`).
* **Modal de Detalhe por Colaborador:**
  * Lista de procedimentos com status: `✅ Concluído (Praticado 3 vezes - Último em 17/09/2026)`.
  * Procedimentos pendentes com botão `Sugerir Treinamento`.

---

## 7. Análise de Viabilidade Técnica e Estimativa de Complexidade

| Componente | Complexidade | Esforço Estimado | Riscos Identificados | Mitigação |
|---|:---:|:---:|---|---|
| **Motor de Overlay & Spotlight (`data-tour`)** | Média | 2 dias | Mudança de scroll ou elementos ocultos no viewport. | `scrollIntoView({ behavior: 'smooth' })` automático e cálculo dinâmico via `ResizeObserver`. |
| **Store de Dados Fictícios (Mock Store)** | Baixa | 1 dia | Conflito com dados reais do usuário logado. | Chaveamento estrito no `AcademyContext`; dados fictícios vivem puramente no estado do React. |
| **Interceptador de Ações Críticas (WhatsApp/NFe)** | Baixa | 1 dia | Disparo acidental de mensagem real para paciente de verdade. | Trava dupla: o botão de envio no modal verifica `isSandboxActive` e não chama o axios/fetch real sob hipótese alguma. |
| **Catálogo de Procedimentos (V1 - 8 procedimentos)** | Média | 2 dias | Procedimentos muito longos cansarem o usuário. | Procedimentos enxutos (máximo de 4 a 6 etapas cada) com linguagem amigável. |
| **Hub da Academy & Painel de Progresso do Gestor** | Baixa | 1.5 dia | Sincronização de contadores de repetição. | UPSERT simples no SQLite com incremento (`completed_count = completed_count + 1`). |
| **Total Global** | **Média** | **~7 a 8 dias de desenvolvimento** | — | Implementação modular, altamente controlável e sem refatorações drásticas no código base. |

---

## 8. Conclusão da Avaliação

A **Synapsis Academy** é **100% viável tecnicamente** e traz um diferencial competitivo de nível corporativo raro em softwares médicos/psicológicos nacionais.  
Ela resolve uma das maiores dores das clínicas de psicologia (tempo gasto por sócios e gestores ensinando recepcionistas e estagiários), eleva a percepção de valor para o nível *Enterprise* e blinda a clínica contra erros operacionais humanos em produção.
