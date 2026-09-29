# Especificação de Design: Matriz de Precificação em Tríade — Synapsis Clínico

**Data:** 19 de Setembro de 2026  
**Metodologia:** Skill Brainstorming (Pesquisa Competitiva, Understanding Lock, Avaliação Incremental e Decision Log)  
**Status:** Validado e Aprovado pelo Usuário  

---

## 1. Sumário Executivo & Objetivos

Esta especificação formaliza a evolução do modelo de precificação do **Synapsis Clínico** de 2 planos para uma **tríade comercial equilibrada**:
1. **Plano Solo / Neuro Solo (Consultório Individual):** Foco em psicólogos e neuropsicólogos autônomos Pessoa Física (PF) + 1 secretária.
2. **Plano Consultório Parceria / PJ (Novo Intermediário):** Foco em consultórios de 2 a 3 psicólogos ou profissionais de alta renda Pessoa Jurídica (PJ) que necessitam de **Emissão Direta de NFS-e Municipal com Certificado Digital A1**.
3. **Plano Clínica & Equipes (Centros Multiprofissionais):** Foco em gestores de clínicas que necessitam de **Engenharia de Repasses Automatizada com Lotes e Quitação PIX**, **Torre de Recepção ao vivo com chamada na TV da sala de espera** e secretárias ilimitadas.

A estratégia comercial adota o **"Lote Promocional de Lançamento"** unificado para os três planos no faturamento anual, estabelecendo barreiras psicológicas de preço agressivas (**R$ 69 / R$ 99 / R$ 129**) contra o concorrente direto (PsicoManager).

---

## 2. Matriz Oficial de Preços & Capacidades

```
+--------------------------------------------------------------------------------------------------------------------------------+
| TABELA OFICIAL DE PREÇOS — TRÍADE SYNAPSIS CLÍNICO                                                                             |
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Parâmetro                          | 👤 1. Plano Solo / Neuro Solo  | 🤝 2. Consultório Parceria / PJ| 🏢 3. Clínica & Equipes |
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Público-Alvo                       | Autônomo PF Individual         | 2 a 3 Terapeutas / PJ Alta Renda| Clínicas Multiprofissionais|
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Assinatura Mensal (Sem Fidelidade) | **R$ 84,00 / mês**             | **R$ 119,00 / mês**            | **R$ 159,00 / mês**     |
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Assinatura Anual (Lote Promocional)| **R$ 69,00 / mês**             | **R$ 99,00 / mês**             | **R$ 129,00 / mês**     |
|                                    | (12x de R$ 69 ou R$ 828/ano)   | (12x de R$ 99 ou R$ 1.188/ano) | (12x de R$ 129 ou R$ 1.548) |
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Profissionais Clínicos Inclusos    | 1 Psicólogo ou Neuropsicólogo  | Até 3 Psicólogos ou Neuro      | Gestor + até 5 Terapeutas|
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Usuários de Recepção / Secretária  | **1 Acesso Gratuito Incluso**  | **Até 2 Acessos Inclusos**     | **ILIMITADAS Gratuitas**|
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Expansão por Terapeuta Adicional   | Upgrade para Parceria          | Upgrade para Clínica           | **+R$ 25,00 / mês** cada |
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Mensagens & Cobranças via WhatsApp | **100% Ilimitado (Zero Taxas)**| **100% Ilimitado (Zero Taxas)**| **100% Ilimitado**      |
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
| Teste Gratuito (Trial)             | **14 Dias Grátis (Sem Cartão)**| **14 Dias Grátis (Sem Cartão)**| **14 Dias Grátis**      |
+------------------------------------+--------------------------------+--------------------------------+-------------------------+
```

---

## 3. Matriz de Distribuição de Funcionalidades (Feature Breakdown)

| Funcionalidade / Módulo | 👤 Solo | 🤝 Parceria / PJ | 🏢 Clínica | Veredito & Posicionamento |
| :--- | :---: | :---: | :---: | :--- |
| **Prontuário CFP 06/2019 com Hash SHA-256** | ✅ Sim | ✅ Sim | ✅ Sim | Integridade pericial universal |
| **Módulo de Avaliação Neuropsicológica & Laudos** | ✅ Sim | ✅ Sim | ✅ Sim | Baterias psicométricas normativas em todos os planos |
| **Cobrança Asaas PIX Dinâmico & Webhook** | ✅ Sim | ✅ Sim | ✅ Sim | Baixa automática em tempo real sem pedir comprovante |
| **Migrador Universal em 1 Clique (PsicoManager)** | ✅ Sim | ✅ Sim | ✅ Sim | Saneamento algorítmico de CPFs e responsáveis |
| **WhatsApp Ilimitado sem Compra de Créditos** | ✅ Sim | ✅ Sim | ✅ Sim | Sem interrupções de lembretes no meio do mês |
| **Carnê-Leão Web & DARF 0190 com Livro-Caixa (PF)** | ✅ **Sim** | ✅ **Sim** | ✅ **Sim** | Dedução de despesas e exportação oficial e-CAC |
| **Emissão Direta de NFS-e Municipal PJ (Certificado A1)** | ❌ Recibos PF | ✅ **SIM (Nativa)** | ✅ **SIM (Nativa)** | **Diferencial Chave:** Nota fiscal direta prefeitura com envio de PDF/XML no WhatsApp |
| **Faturamento Parcelado de Pacotes Asaas (até 12x)** | ❌ Básico | ✅ **Sim** | ✅ **Sim** | Gestão de pacotes de psicoterapia e neuro |
| **Divisão de Rateio Simples & Sublocação de Salas** | ❌ Básico | ✅ **Sim** | ✅ **Sim** | Gestão de despesas compartilhadas entre parceiros |
| **Torre de Recepção ao Vivo com Chamada na TV** | ❌ Não | ❌ Não | ✅ **SIM** | Chamada sonora/visual na tela da sala de espera |
| **Engenharia de Repasses sobre Sessões Pagas** | ❌ Não | ❌ Não | ✅ **SIM** | Blindagem anti-calote: honorários só sobre quitadas |
| **Fechamento de Lotes em PDF com PIX (`LOTE-001`)** | ❌ Não | ❌ Não | ✅ **SIM** | Extrato formal timbrado com quitação mútua |
| **Portal "Minha Produtividade" (Zero-Knowledge)** | ❌ Não | ❌ Não | ✅ **SIM** | Psicólogo vê comissões sem ver faturamento global |
| **Separação Estrita de Perfis (RBAC Avançado)** | ❌ Não | ❌ Não | ✅ **SIM** | Recepção sem acesso a prontuários |
| **Synapsis Academy: Onboarding em Sandbox** | ✅ Sim | ✅ Sim | ✅ Sim | Treinamento interativo seguro com dados fictícios |

---

## 4. Decision Log (Registro Oficial de Decisões)

### Decisão 1: Criação do Plano Consultório Parceria / PJ (Intermediário)
* **O que foi decidido:** Criar um plano intermediário dedicado a consultórios de até 3 profissionais e psicólogos PJ.
* **Alternativas consideradas:** Manter 2 planos ou cobrar puramente por profissional adicional.
* **Motivo:** O PsicoManager força duplas ou trios a pagar contas individuais separadas (2x R$ 89 = R$ 178 ou 3x R$ 89 = R$ 267) ou pular direto para o plano clínica cheia. A Synapsis preenche essa lacuna com uma oferta imbatível de R$ 99/mês.

### Decisão 2: Precificação Agressiva (R$ 69 / R$ 99 / R$ 129 no Anual)
* **O que foi decidido:** Adotar a Opção 3 com barreira dos dois dígitos no intermediário (R$ 99,00) e entrada agressiva no Solo a R$ 69,00.
* **Alternativas consideradas:** Opção 2 (R$ 74 / R$ 109,90 / R$ 139,90).
* **Motivo:** R$ 99/mês é a barreira psicológica mais forte do SaaS brasileiro. Com a Clínica a R$ 129,00, ela se iguala nominalmente ao PsicoManager (R$ 129,90), mas oferecendo WhatsApp ilimitado, NFS-e e repasses com PIX inclusos.

### Decisão 3: Manutenção de Secretária Gratuita no Plano Solo
* **O que foi decidido:** 1 acesso de recepção/secretária gratuito garantido no Plano Solo.
* **Motivo:** No consultório individual, o psicólogo frequentemente compartilha recepcionista do edifício ou contrata secretária remota. Proibir esse acesso geraria atrito no onboarding.

### Decisão 4: Emissão Direta de NFS-e Municipal a partir do Plano Intermediário
* **O que foi decidido:** Habilitar integração nativa com Certificado A1 para NFS-e já no Plano Parceria / PJ.
* **Motivo:** Consultórios de 1 a 3 psicólogos de alto padrão faturam como PJ e têm a emissão de notas para reembolso de convênios como dor diária crítica.

### Decisão 5: Reserva de Repasses Avançados e Torre de TV para a Clínica
* **O que foi decidido:** Repasses formais com fechamento de lotes (`LOTE-YYYY-MM-001`), quitação assinada em PDF e Torre com chamada na TV são exclusivos do Plano Clínica.
* **Motivo:** Garante incentivo claro de upgrade para centros clínicos estruturados que lidam com alta complexidade operacional.
