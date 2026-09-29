# Especificação de Design: Migrador Universal v2.4 (CSV / XLSX)

**Status:** Validado e Aprovado via Brainstorming  
**Data:** 18 de Setembro de 2026  
**Produto:** Synapsis Clínico  
**Responsável:** Arquitetura de Produto & Engenharia  

---

## 1. Contexto e Motivação

A Landing Page do Synapsis Clínico anuncia com destaque o **Migrador Universal em 1 Clique (CSV / XLSX)**, prometendo uma transição suave (*"Troca sem Dor"*) com base no **Artigo 18 da LGPD**.

Anteriormente, o sistema contava apenas com um importador de pacientes específico para arquivos CSV do PsicoManager (`psicoManagerImporter.ts`), com interface modesta, sem suporte a arquivos Excel `.xlsx` e sem mapeamento para outros grandes concorrentes do mercado.

Este documento consolida o design da solução **PREMIUM** do Migrador Universal, expandindo o ecossistema com suporte nativo a planilhas Excel (.xlsx), presets homologados para os quatro principais softwares do mercado de saúde mental e clínica multiprofissional, assistente de *De-Para* para planilhas personalizadas e merge não-destrutivo de cadastros.

---

## 2. Resumo do Entendimento (Understanding Summary)

* **O que é:** Suíte de migração cadastral universal no frontend e backend, capaz de ingerir arquivos `.xlsx`, `.xls` e `.csv`, detectar automaticamente o software de origem ou oferecer assistente visual de correspondência de colunas, com telemetria prévia (*dry-run*) e gravação atômica.
* **Para quem é:** Secretárias, recepcionistas, gestores de clínica e psicólogos realizando a transição de seus pacientes para o Synapsis Clínico.
* **Por que existe:** Remover a maior barreira de saída de sistemas legados e entrada no Synapsis Clínico, eliminando 100% da redigitação manual de fichas.
* **Escopo Definido:** Foco estrito em cadastros de **Pacientes**, seus dados demográficos, contatos, faixas etárias e múltiplos responsáveis (pais/mães/tutores de menores).
* **Não-Escopo (Non-Goals):** Não abrange migração de prontuários clínicos antigos, notas de evolução diárias, agendas de sessões passadas ou conciliação financeira histórica nesta fase.

---

## 3. Premissas e Requisitos Não-Funcionais (NFRs)

* **Performance:** Capacidade de processar e validar arquivos de até 5.000 pacientes em menos de 3 segundos no cliente e gravar a transação no backend em menos de 2 segundos.
* **Formatos Suportados:** `.xlsx`, `.xls`, `.csv`, `.tsv` de até 15 MB.
* **Privacidade & LGPD:** O arquivo é processado e estruturado em memória no navegador; nenhum arquivo binário temporário é gravado em disco no servidor.
* **Transacionalidade:** Persistência no SQLite encapsulada em transação única atômica (`BEGIN TRANSACTION ... COMMIT`), com rollback automático se houver erro crítico.
* **Auditoria:** Registro no log pericial (`audit_logs`) com ID do usuário, IP, timestamp e sumário de pacientes criados/atualizados.

---

## 4. Registro de Decisões (Decision Log)

| # | Decisão Tomada | Alternativas Consideradas | Motivo da Escolha |
|---|---|---|---|
| **D1** | **Escopo Focado em Pacientes (Cadastral Universal)** | Migração total (com evoluções/financeiro) ou Concierge manual | Alinhamento imediato com a promessa da Landing Page sem os riscos de integridade de prontuários legados desestruturados. |
| **D2** | **Merge Inteligente Não-Destrutivo** | Sobrescrita total ou Tela de diff linha por linha | Preenche apenas lacunas em branco de pacientes já cadastrados, sem apagar personalizações feitas pela clínica. |
| **D3** | **Tolerância com Saneamento & Tag de Pendência** | Bloqueio rígido/rejeição ou Editor de células inline | Evita travar a clínica por causa de planilhas antigas sem CPF; higieniza e gera lista de pendências para resolução calma posterior. |
| **D4** | **Presets dos 4 Líderes + Modo De-Para Inteligente** | Algoritmo puramente agnóstico ou Central pesada de histórico | Atende de imediato PsicoManager, iClinic, Feegow e Zenklub com 1 clique e oferece flexibilidade total para qualquer outro Excel. |
| **D5** | **Wizard Híbrido Reativo (Parsing no Cliente + API Atômica)** | Upload binário multipart no servidor ou Template rígido obrigatório | Zero persistência de arquivos em disco (máxima segurança LGPD), preview instantâneo e sem sobrecarga no Node.js. |

---

## 5. Arquitetura e Especificação Técnica

### 5.1 Pipeline de Processamento (4 Estágios)

```
[Arquivo XLSX / CSV]
        │
        ▼ (SheetJS / PapaParse em memória)
[1. Detector de Presets & Heurística]
        │ ├── PsicoManager (Headers: "Nome", "CPF", "Telefone Principal", ...)
        │ ├── iClinic / Doctoralia (Headers: "Nome Completo", "Celular", "CPF", ...)
        │ ├── Feegow Clinic (Headers: "Paciente", "Documento", "Telefone 1", ...)
        │ ├── Zenklub (Headers: "Nome", "Email", "Telefone", ...)
        │ └── Genérico / Excel Manual (Fallback para assistente De-Para)
        │
        ▼
[2. Normalização e Higienização Clínica]
        │ ├── Normalização de datas (DD/MM/YYYY, YYYY-MM-DD e Seriais Excel)
        │ ├── Saneamento de CPFs (limpeza, padStart(11, '0'), validação algorítmica)
        │ ├── Formatação de telefones/WhatsApp
        │ ├── Cálculo etário (Criança < 12, Adolescente < 18, Idoso >= 60, Adulto)
        │ └── Vínculo de responsável legal/financeiro para menores
        │
        ▼
[3. Simulação Visual & Telemetria (Dry-Run)]
        │ ├── Total de registros detectados
        │ ├── Contagem de novos pacientes vs. enriquecimentos de existentes
        │ ├── Identificação de cadastros com documentação pendente
        │ └── Amostra visual de conferência (5 primeiros registros)
        │
        ▼ (POST /patients/universal-import)
[4. Gravação Atômica no Backend & Auditoria]
        │ ├── Transação única SQLite
        │ ├── Merge condicional seguro no banco
        │ └── Evento em audit_logs
```

### 5.2 Estrutura de Presets Homologados

```typescript
export interface SystemPreset {
  id: string;
  name: string;
  badgeColor: string;
  matchScore: (headers: string[]) => number; // Retorna confiança entre 0 e 1
  columnMapping: {
    fullName: string[];
    cpf: string[];
    birthDate: string[];
    phone: string[];
    email: string[];
    rg?: string[];
    gender?: string[];
    profession?: string[];
    street?: string[];
    number?: string[];
    complement?: string[];
    neighborhood?: string[];
    city?: string[];
    state?: string[];
    cep?: string[];
    guardianName?: string[];
    guardianPhone?: string[];
    guardianCpf?: string[];
    guardianRelationship?: string[];
  };
}
```

### 5.3 Componentes de Frontend

* `src/components/patients/UniversalMigratorModal.tsx`:
  * Modal responsivo com estilo premium Synapsis.
  * Suporte a drag-and-drop de `.xlsx` e `.csv`.
  * Chips visuais com status de detecção dos 4 sistemas concorrentes.
  * Tela de De-Para intuitiva com select boxes caso o preset não atinja 80% de confiança.
  * Telemetria visual com 4 métricas-chave em tempo real.
  * Sumário executivo pós-importação com lista de pendências e botão de download.
* Pontos de entrada:
  * `PatientListView.tsx`: Botão repaginado `[ 🚀 Migrador Universal (XLSX / CSV) ]`.
  * `ClinicSettings.tsx`: Seção informativa e atalho para o Migrador Universal.

### 5.4 Endpoints de Backend

* `POST /patients/universal-import`:
  * Payload: `{ patients: Array<NormalizedPatientData>, sourceSystem: string }`
  * Valida payload com Zod/TypeScript.
  * Executa loop de conferência contra CPFs e Nomes já cadastrados.
  * Aplica merge em campos vazios ou insere novo paciente com status `ACTIVE` e tag condicional `"DOCUMENTACAO_PENDENTE"`.
  * Registra evento em `audit_logs`.
  * Retorna contadores exatos e amostra dos registros processados.

---

## 6. Plano de Homologação e Testes

1. **Fixtures de Teste:**
   * `scratch/sample_psicomanager.csv`: Arquivo CSV padrão PsicoManager.
   * `scratch/sample_iclinic.xlsx`: Planilha XLSX padrão Doctoralia / iClinic.
   * `scratch/sample_feegow.xlsx`: Planilha XLSX padrão Feegow Clinic.
   * `scratch/sample_zenklub.csv`: Arquivo CSV padrão Zenklub.
   * `scratch/sample_custom.xlsx`: Planilha personalizada do Excel com cabeçalhos não-padronizados.
2. **Critérios de Aceite:**
   * Detecção automática correta para os 4 presets com 1 clique.
   * Capacidade de importar tanto `.xlsx` quanto `.csv`.
   * Normalização correta de datas seriais do Excel e formatos brasileiros.
   * Preenchimento de responsáveis para menores e cálculo de faixa etária.
   * Preservação de dados existentes em caso de duplicidade de CPF/Nome.
   * Zero regressões de tipagem (`tsc --noEmit`).
