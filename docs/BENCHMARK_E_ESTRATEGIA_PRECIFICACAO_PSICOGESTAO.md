# Benchmark de Concorrentes & Estratégia Oficial de Precificação — PsicoGestão SaaS

**Data:** 17 de Setembro de 2026  
**Metodologia:** Skill de Brainstorming (Pesquisa Competitiva, Understanding Lock, Avaliação Incremental e Decision Log)  
**Status:** Validado e Aprovado  

---

## 1. Sumário Executivo

Este documento consolida o estudo de mercado e a definição da estratégia comercial, pacotes de serviços e matriz de precificação do **PsicoGestão SaaS**.

O projeto posiciona-se como uma plataforma de gestão clínica e financeira de alto padrão para psicólogos, neuropsicólogos e clínicas multiprofissionais no Brasil. A proposta de valor ataca diretamente as três maiores vulnerabilidades dos sistemas legados:
1. **Engenharia de Repasses com Blindagem de Caixa:** Garantia de que a clínica só repassa honorários sobre consultas efetivamente quitadas pelos pacientes, com extrato formal timbrado em PDF e chave PIX.
2. **Módulo Nativo de Avaliação Neuropsicológica:** Gerenciamento completo de pacotes de sessões, baterias de testes psicométricos normativos e emissão de laudos estruturados (CID-11 / DSM-5), recurso ausente nos líderes de mercado.
3. **Conformidade Ética Pericial (CFP 06/2019 e LGPD):** Integridade de prontuários respaldada por hash criptográfico SHA-256 e criptografia AES-256-GCM em repouso.

---

## 2. Benchmark Detalhado do Mercado Nacional

### 2.1. Concorrentes Diretos Especializados em Psicologia

| Plataforma | Público-Alvo | Planos & Preços (Ref. Mensal / Anual) | Pacotes & Limitações | Pontos Fracos / Gaps Competitivos |
| :--- | :--- | :--- | :--- | :--- |
| **PsicoManager** *(Líder de nicho)* | Psicólogos individuais e clínicas de psicologia | • **Individual Pró:** ~R$ 89,00/mês<br>• **Individual Plus:** ~R$ 119,00/mês<br>• **Clínica:** A partir de R$ 129,90/mês (até 6 profissionais; extras sob consulta) | Agenda, prontuário CFP, app do paciente. Nos planos mais baratos impõe **limites de créditos para WhatsApp** (200 mensagens/mês) e IA. | **Repasses frágeis** (sem blindagem de inadimplência, sem recibo oficial timbrado com PIX); **zero módulo neuropsicológico**; sem imutabilidade SHA-256. |
| **Sinappsy** | Recém-formados e baixa volumetria | • **Essencial:** R$ 29,90/mês (até 50 pacientes)<br>• **Profissional:** R$ 49,90/mês (até 100 pacientes)<br>• **Premium:** R$ 89,90/mês (ilimitado) | Prontuário simples, controle financeiro básico e agenda. Cobrança atrelada ao número de pacientes cadastrados. | Não atende equipes ou clínicas; sem suporte a repasses; sem avaliações neuropsicológicas; financeiro elementar. |
| **GestorPsi** | Autônomos com foco em custo-benefício | • **Individual:** A partir de ~R$ 34,50/mês | Agenda, prontuário, pacientes ilimitados, perfil para secretária. | Interface visual antiga; ausência de automações inteligentes (WhatsApp e IA); inadequado para clínicas com múltiplos terapeutas. |
| **Psicoplanner / PsiNota AI** | Profissionais focados em escrita clínica com IA | • **Modelos Freemium a Assinatura:** R$ 69,00 a R$ 99,00/mês | Transcrição de áudio por inteligência artificial para elaboração de prontuários. | Nichado exclusivamente em anotação; não atende gestão operacional, financeira ou clínicas com equipe. |

---

### 2.2. Concorrentes Multiprofissionais & ERPs de Saúde

| Plataforma | Público-Alvo | Modelo de Cobrança | Valores Praticados | Gaps para Clínicas de Psicologia |
| :--- | :--- | :--- | :--- | :--- |
| **iClinic** *(Afya)* | Médicos e consultórios de saúde em geral | Cobrança por profissional de saúde | **R$ 89,00 a R$ 160,00+/mês** por profissional | Prontuário médico genérico (não segue as 5 seções do CFP); custo se multiplica rapidamente em equipes; sem neuropsicologia. |
| **Amplimed** | Clínicas médicas e policlínicas | Cobrança por profissional ativo + add-ons | A partir de **R$ 99,00/mês** por profissional | Foco em faturamento de convênios (TISS) e medicina tradicional; complexidade excessiva para psicologia. |
| **Feegow Clinic** | Clínicas de médio e grande porte | Cobrança por profissional de saúde | **R$ 129,00 a R$ 249,00/mês** por usuário | Curva de aprendizado íngreme; interface densa e cara para o ecossistema de psicologia. |
| **Clínica nas Nuvens** | Grandes clínicas e centros de saúde | Valor fixo para até 3 profissionais + expansões | A partir de **R$ 499,00/mês** | Tíquete de entrada proibitivo para clínicas de psicologia de pequeno e médio porte. |
| **ByDoctor** | Clínicas que buscam previsibilidade de custos | Preço Fixo por Clínica | ~**R$ 147,00/mês** | Generalista; sem foco nas normas éticas específicas do CFP e sem laudos neuropsicológicos. |

---

### 2.3. Marketplaces e Plataformas de Teleconsulta

* **Zenklub (ZenOffice) / Vittude:**  
  * Modelo baseado em intermediação de consultas: Plano Gratuito (comissão de **20% por sessão**) ou Plano Premium (**R$ 499,00/mês** ou R$ 4.999/ano + taxa de 3,99% por sessão).  
  * Não compete como ERP completo para consultórios presenciais ou clínicas físicas multiprofissionais; funciona primariamente como canal de captação B2B/B2C.

---

## 3. Matriz Oficial de Planos & Precificação do PsicoGestão SaaS

A estratégia adotada é o **Modelo Híbrido Estratégico com Duas Portas Claras**, oferecendo previsibilidade total, sem taxas ocultas e sem venda de créditos avulsos:

```
+---------------------------------------------------------------------------------------------------------------+
| TABELA OFICIAL DE PREÇOS — PSICOGESTÃO SAAS                                                                   |
+------------------------------------+------------------------------------------+-------------------------------+
| Parâmetro                          | 👤 Plano Solo / Neuro Solo               | 🏢 Plano Clínica & Equipes     |
+------------------------------------+------------------------------------------+-------------------------------+
| Público-Alvo                       | Psicólogo ou Neuropsicólogo Autônomo     | Clínicas, Coworkings e Centros|
|                                    | (Consultório individual)                 | de Neuropsicologia            |
+------------------------------------+------------------------------------------+-------------------------------+
| Assinatura Mensal                  | **R$ 89,00 / mês**                       | **R$ 149,00 / mês**           |
+------------------------------------+------------------------------------------+-------------------------------+
| Assinatura Anual (Lançamento)      | **R$ 74,00 / mês**                       | **R$ 119,90 / mês**           |
|                                    | (R$ 890,00/ano à vista ou 12x)           | (R$ 1.438,80/ano ou 12x)      |
+------------------------------------+------------------------------------------+-------------------------------+
| Profissionais de Saúde Inclusos    | 1 Psicólogo / Terapeuta                  | Até 5 Psicólogos / Terapeutas |
+------------------------------------+------------------------------------------+-------------------------------+
| Equipe de Recepção / Secretárias   | 1 Acesso Opcional Gratuito               | Ilimitadas (sem custo extra)  |
+------------------------------------+------------------------------------------+-------------------------------+
| Expansão por Terapeuta Adicional   | Não aplicável (upgrade para Clínica)     | **+R$ 25,00 / mês** por psicólogo|
+------------------------------------+------------------------------------------+-------------------------------+
| Período de Teste Gratuito (Trial)  | **14 Dias Grátis** (Sem Cartão)          | **14 Dias Grátis** (Sem Cartão)|
+------------------------------------+------------------------------------------+-------------------------------+
| Mensagens & Cobranças via WhatsApp | **Ilimitado** (Zero custo de créditos)   | **Ilimitado** (Zero créditos) |
+------------------------------------+------------------------------------------+-------------------------------+
```

---

## 4. Matriz de Recursos por Plano (Feature Breakdown)

| Funcionalidade / Recurso | 👤 Plano Solo | 🏢 Plano Clínica & Equipes | Diferencial de Mercado |
| :--- | :---: | :---: | :--- |
| **Prontuário com 5 Seções CFP 06/2019** | ✅ Completo | ✅ Completo | Específico para psicologia |
| **Assinatura Irreversível com Hash SHA-256** | ✅ Sim | ✅ Sim | Prova matemática contra adulterações |
| **Criptografia em Repouso AES-256-GCM** | ✅ Sim | ✅ Sim | Proteção total de dados sensíveis LGPD |
| **Módulo Nativo de Avaliação Neuropsicológica** | ✅ Sim (1 prof.) | ✅ Sim (Toda a equipe) | **Exclusivo:** Pacotes, testes e laudos |
| **Hub de Escalas Psicométricas (BDI, BAI)** | ✅ Incluso | ✅ Incluso | Cálculo automático de gravidade |
| **Roteamento de WhatsApp para Responsáveis de Menores** | ✅ Sim | ✅ Sim | Previne mensagens para celulares de crianças |
| **Recibos IRPF / DMED e Atestados com Tags Dinâmicas** | ✅ Sim | ✅ Sim | Com dados e logotipo da clínica |
| **Cobrança Inteligente Asaas & Baixa via Webhook** | ✅ Sim | ✅ Sim | **Exclusivo:** PIX dinâmico com baixa automática sem pedir comprovante |
| **Migrador Dedicado do PsicoManager (1 Clique)** | ✅ Sim | ✅ Sim | **Exclusivo:** Upload de CSV oficial com saneamento de CPFs |
| **Torre de Controle ao Vivo (Dashboard da Recepção)** | ❌ Básico | ✅ **Sim** | Status ao vivo: em atendimento/próximo |
| **Engenharia de Repasses sobre Sessões Quitadas** | ❌ Desativado | ✅ **Sim** | **Exclusivo:** Fim das brigas de fim de mês |
| **Fechamento de Lote Oficial com Extrato em PDF e PIX** | ❌ Desativado | ✅ **Sim** | Documento timbrado com quitação mútua |
| **Portal do Terapeuta ("Minha Produtividade")** | ❌ Desativado | ✅ **Sim** | Sigilo Zero-Knowledge entre sócios e clínica |
| **Controle de Acessos por Papel (RBAC Estrito)** | ❌ Simplificado | ✅ **Sim** | Secretária nunca abre prontuário |

---

## 5. Estratégia de Transição Suave & Suporte Automatizado por Agentes

### 5.1. Transição Segura e Sem Interrupção dos Atendimentos
* **Rejeição ao modelo de migração apressada:** Compreende-se que psicólogos e donos de clínicas têm cautela extrema com histórico clínico e financeiro.
* **Coexistência Temporária Assistida:** O cliente é incentivado a manter a plataforma antiga em paralelo durante o primeiro mês para validação gradual, sem interrupção dos atendimentos diários.
* **Migrador PsicoManager em 1 Clique:** Ferramenta dedicada que lê a exportação oficial do PsicoManager, valida os CPFs da Receita Federal e mapeia automaticamente os pais e responsáveis legais de pacientes menores.


### 5.2. Suporte Operacional Automatizado por Agentes de IA (24/7)
* **Atendimento Nível 1 e 2 Automatizado:** Agentes inteligentes respondem instantaneamente a dúvidas sobre parametrização da clínica, fechamento de repasses, assinatura de prontuários no padrão CFP e disparos de WhatsApp.
* **Onboarding Contextual:** Guia interativo que acompanha o novo gestor nos primeiros cliques dentro do sistema.
* **Escala com Custo Marginal Zero:** Mais de 85% das dúvidas são sanadas em segundos, preservando a equipe fundadora para relacionamento estratégico e escalonamento apenas de casos complexos.

---

## 6. Decision Log (Registro de Decisões do Brainstorming)

1. **Decisão 1 — Posicionamento de Mercado:**  
   * *Decisão:* Adotar o modelo híbrido escalonado com duas portas claras (Solo e Clínica).  
   * *Alternativas consideradas:* Foco exclusivo em clínicas de alto tíquete vs. Modelo puramente focado em volume de autônomos por baixo custo.  
   * *Justificativa:* Permite capturar neuropsicólogos e psicólogos autônomos de alto valor que atendem sozinhos, ao mesmo tempo em que monetiza com força as clínicas que sofrem com repasses e gestão de equipes.
2. **Decisão 2 — Escalabilidade do Plano Clínica:**  
   * *Decisão:* Base de R$ 179/mês cobrindo até 5 psicólogos + R$ 25/mês por psicólogo adicional, com secretárias ilimitadas.  
   * *Alternativas consideradas:* Tiers rígidos por faixa de equipe vs. Preço fixo com profissionais ilimitados.  
   * *Justificativa:* Proporciona o melhor equilíbrio entre valor percebido de entrada (altamente acessível para pequenas clínicas) e expansão previsível de faturamento conforme a clínica cresce.
3. **Decisão 3 — Política de Trial e Plano Anual:**  
   * *Decisão:* 14 dias grátis sem cartão de crédito + Plano Anual com 2 meses grátis (~16,7% de desconto: R$ 74/mês no Solo e R$ 149/mês na Clínica).  
   * *Alternativas consideradas:* 7 dias grátis com cartão prévio vs. Garantia de reembolso de 100%.  
   * *Justificativa:* Maximiza a taxa de cadastro de leads, remove a barreira de entrada e estimula a contratação anual para zerar o churn.
4. **Decisão 4 — Política de WhatsApp Transparente:**  
   * *Decisão:* Confirmações e cobranças via WhatsApp Web/Desktop nativas e ilimitadas, sem cobrança de créditos adicionais.  
   * *Alternativas consideradas:* Venda de pacotes de créditos avulsos (modelo PsicoManager).  
   * *Justificativa:* Elimina uma das maiores queixas de clientes do concorrente (faturas imprevisíveis com compra de créditos).
5. **Decisão 5 — Abordagem de Migração e Suporte:**  
   * *Decisão:* Transição suave e segura (sem promessas de "24h") com suporte 24/7 automatizado por Agentes de IA.  
   * *Alternativas consideradas:* Migração imediata com corte forçado da ferramenta antiga vs. Suporte puramente humano via WhatsApp.  
   * *Justificativa:* Alinha-se ao perfil conservador dos profissionais de saúde e permite escalar o SaaS com custos operacionais controlados.
