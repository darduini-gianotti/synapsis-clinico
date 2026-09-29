# 📦 Dossiê de Migração & Continuidade: Landing Page Synapsis Clínico

> **Objetivo deste documento:**  
> Reunir 100% do histórico, decisões estratégicas de branding, código-fonte, arquitetura e especificações da Landing Page do **Synapsis Clínico**, permitindo que uma nova conversa no Antigravity continue o projeto com total clareza, sem perder nenhum contexto e sem misturar com o desenvolvimento do sistema principal.

---

## 🚀 Como Inicializar uma Nova Conversa no Antigravity

Quando você abrir uma nova janela/conversa no Antigravity, basta copiar e colar a mensagem abaixo:

```markdown
Olá! Esta conversa é dedicada exclusivamente à continuidade, melhorias e publicação da Landing Page do Synapsis Clínico.

Por favor, leia atentamente os arquivos de contexto:
- @docs/DOSSIE_MIGRACAO_LANDING_PAGE_SYNAPSI.md (dossiê completo de branding, decisões e estrutura)
- @landing/index.html (código-fonte completo da Landing Page em funcionamento)

Com base nisso, estou pronto para prosseguir com as revisões e próximos passos da Landing Page!
```

Ao fazer isso, o agente na nova conversa carregará instantaneamente toda a bagagem de conhecimento!

---

## 🧭 1. Identidade, Branding & Posicionamento de Mercado

### Nome Comercial Escolhido
* **Nome Definitivo do Produto:** **Synapsis Clínico** (com **"s"** final, latim científico clássico).
* **Conceito & Território:** Território A (Científica & Neurociência). A palavra *synapsis* simboliza a conexão neural e a transmissão de impulsos por excelência, transmitindo rigor acadêmico, autoridade médica e tecnologia moderna para psicólogos e neuropsicólogos.
* **Formato do Header / Logo:** Layout horizontal (*"o nome ao lado"*), unindo o ícone luminoso Brain "S" (`synapsi_brain1.png`) à tipografia em alto contraste: **Synapsis** (branco puro em negrito extra) e **Clínico** (teal luminoso), eliminando peso vertical e garantindo legibilidade imediata em modo escuro.
* **Slogan Oficial Aprovado:**
  > *"A conexão definitiva entre a ciência clínica, a neuropsicologia e a gestão do seu consultório."*
* **Paleta de Cores:**
  * **Brand Primary:** Tons Esmeralda / Teal (`#0d9488`, `#14b8a6`, `#2dd4bf`) — saúde, confiança, frescor.
  * **Neuro / Especialidades:** Tons Índigo / Violeta (`#6366f1`, `#4f46e5`) — neurociência, cognição, inteligência.
  * **Dark Mode Sofisticado:** Fundo Slate 900/950 (`#0f172a`, `#020617`) com tipografia *Plus Jakarta Sans*.

### Diretriz Ética & Comercial de Mercado (Zero Citações Nominais)
* Durante as sessões de brainstorming, foi estabelecido que a Landing Page **não cita softwares concorrentes nominalmente** (ex: PsicoManager).
* Todas as menções foram convertidas para termos elegantes de liderança de categoria:
  * *"Softwares Tradicionais de Psicologia"*
  * *"Seu software atual"*
  * *"Sistemas médicos genéricos"*
* **Benefícios:**
  1. Postura de líder absoluto e inovador do setor.
  2. Universalidade para captar clientes que usam qualquer software do mercado ou planilhas.
  3. Blindagem jurídica total contra notificações perante o CONAR ou alegações de publicidade comparativa desleal.

---

## 🏗️ 2. Arquitetura Técnica & Inventário de Arquivos

| Arquivo / Recurso | Localização | Descrição |
| :--- | :--- | :--- |
| **Página Principal da Landing Page** | `landing/index.html` | Arquivo único, estático, autossuficiente e responsivo. Construído com Tailwind CSS (via CDN) e Vanilla JS nativo. Zero dependências pesadas, carregamento instantâneo (< 0.8s) e 95+ no Google Core Web Vitals. |
| **Servidor de Pré-visualização** | `server.ts` | Rota estática configurada na linha 164 (`app.use('/landing', express.static(path.join(process.cwd(), 'landing')));`). Servida localmente em `http://localhost:3000/landing`. |
| **Estratégia Multi-Agent Inicial** | `docs/ESTRATEGIA_LANDING_PAGE_MULTI_AGENT.md` | Registro detalhado do primeiro brainstorming de definição de canais e arquitetura. |
| **Documentação Geral da Plataforma** | `docs/DOCUMENTACAO_COMPLETA_PLATAFORMA_PSICOGESTAO.md` | Especificação completa dos 12 módulos internos, RBAC, hash CFP e criptografia AES-256. |

---

## 📑 3. As 11 Seções Estratégicas Implementadas em `landing/index.html`

1. **Header / Navbar Institucional Responsivo:** Logo Oficial Synapsis Clínico (*Brain S + Synapsis Clínico* com subtítulo oficial *"Psicologia • Neuropsicologia • Gestão"* em alto contraste), navegação desktop limpa em links diretos sem popovers invasivos que obstruam o Hero (Diferenciais, Tour HD, Demos ao Vivo com badge pulsante, Repasses, Calculadora, Comparativo e Dúvidas), botão CTA responsivo de agendamento e Drawer Menu móvel tátil com fundo sólido escuro.
2. **Hero Section:**
   * Badge pulsante: *"A Nova Referência em Software para Clínicas de Psicologia e Neuropsicologia"*.
   * Headline: *"A Conexão Definitiva entre a Ciência Clínica, a Neuropsicologia e a Gestão do seu Consultório."*
   * Subheadline focada na autoridade clínica e jurídica: *"Prontuário imutável com prova criptográfica SHA-256 (CFP 06/2019) e Módulo Exclusivo de Avaliação Neuropsicológica."*
   * CTAs duplos (WhatsApp VIP + Conhecer Recursos).
   * Mockup realista em janela de sistema simulando o dashboard ao vivo com profissionais em atendimento.
3. **Barra de Selos & Autoridade Técnica:**
   * *Resolução CFP 06/2019* (Hash SHA-256 de inviolabilidade).
   * *Criptografia AES-256-GCM* em repouso.
   * *Artigo 18 da LGPD* (Portabilidade e posse total dos dados pela clínica).
   * *Blindagem de Caixa* (Repasse pago exclusivamente sobre sessões quitadas).
4. **Grid dos 4 Pilares de Valor:**
   * Repasses Automáticos com Chave PIX e dedução de sublocação.
   * Módulo Exclusivo de Avaliação Neuropsicológica (baterias, escores z, percentis normativos).
   * Prontuário Eletrônico Imutável em 5 seções do CFP.
   * Torre de Recepção ao Vivo (status em tempo real dos consultórios).
5. **Calculadora Interativa de Economia:**
   * Slider dinâmico em JavaScript puro (1 a 25 terapeutas na clínica).
   * Cálculo em tempo real de horas poupadas e valor protegido contra calotes de pacientes.
6. **Tabela Comparativa Direta de Mercado:**
   * Comparação lado a lado: **Synapsi Clínico** vs. **Softwares Tradicionais** vs. **Sistemas Médicos Genéricos** vs. **Planilhas Excel**.
   * Destaque para recursos exclusivos: Regra de Ouro nos repasses, Hash SHA-256, Roteamento inteligente de WhatsApp para pais de menores e Módulo Neuro nativo.
7. **Tour Visual dos Módulos com Lightbox Full HD:**
   * Abas com prévias condensadas dos 4 módulos.
   * Botão **"🔍 Ampliar Tela em Alta Definição (Full HD)"** que abre um modal em tela cheia com navegação por teclado (`ESC`, `←`, `→`) para inspecionar cada detalhe dos prontuários e laudos.
8. **Veja na Prática: 5 Micro-Demos Interativas (`#microdemos`):**
   * **Demo 1 (Cobrança WhatsApp PIX):** Simula o envio de lembrete com QR code para *Gabriel Santos (R$ 220,00)* e a compensação instantânea em 3 segundos pelo Banco Central, liberando o repasse de R$ 132,00 da psicóloga Dra. Camila Duarte.
   * **Demo 2 (Agenda Drag & Drop):** Simula o reagendamento da paciente *Beatriz Lins* das 14h para as 16h com validação anticonflito de sala e envio automático de notificação no WhatsApp.
   * **Demo 3 (Lacração CFP 06/2019):** Editor com anotação da sessão de *Lucas Oliveira* onde o terapeuta clica em *"Assinar e Lacrar"*, gerando o certificado com Hash SHA-256 e trancando o registro de forma imutável.
   * **Demo 4 (Laudo Neuropsicológico Estruturado CID-11):** Seletor de hipótese clínica (TDAH 6A05.0, Dislexia 6A03.0, Altas Habilidades 6A0Y), visualização de gráfico normativo de percentis e simulação de emissão de laudo timbrado com assinatura digital.
   * **Demo 5 (Sublocação & Gestão de Consultórios):** Seletor de modelo de sublocação (hora fixa R$ 45 vs rateio percentual), grade de salas com detecção ativa de conflito de horário e conciliação instantânea no extrato de repasse.
9. **Seção de Migração Assistida (LGPD):**
   * Esclarecimento sobre o Artigo 18 da LGPD (*"A clínica é a única dona dos dados, o software antigo não pode reter seus pacientes"*).
   * Passo a passo em 3 etapas com migração assistida em até 48 horas.
10. **FAQ Interativo em Acordeão:**
    * Resposta detalhada para as 6 maiores dúvidas de gestores e psicólogos.
11. **Planos, Formulário & Rodapé:**
    * Comparativo entre Plano Solo (consultório individual) e Plano Clínica (equipes e repasses).
    * Formulário de captura de leads com integração instantânea para o WhatsApp.
    * Rodapé institucional completo.

---

## 👥 4. Diretório de Dados Fictícios Certificados (LGPD & CFP)

Todos os dados exibidos nas demonstrações e telas da Landing Page são **100% fictícios** e verificados:

* **Pacientes Fictícios:**
  * `Lucas Oliveira`: 28 anos, programador. Caso de TAG / TCC (prontuário imutável).
  * `Beatriz Lins`: 9 anos e 4 meses, estudante do 4º ano. Caso de avaliação neuropsicológica (TDAH).
  * `Carlos Mendes`: Paciente adulto em atendimento na Sala 01.
  * `Gabriel Santos`: Paciente com acerto pendente para demonstração de cobrança PIX.
  * `Fernanda e Rodrigo`: Casal fictício na sala de espera (Consultório 03).
* **Profissionais Fictícios:**
  * `Dra. Camila Duarte`: CRP 06/123456 (Psicóloga Clínica TCC).
  * `Dr. Marcos Silveira`: CRP 06/128945-SP (Neuropsicólogo).
  * `Dra. Vanessa`: Terapeuta de casal e família.
* **Selos Legais nos Componentes:**
  * `[Ambiente de Demonstração — Dados 100% Fictícios em Conformidade com a LGPD e Resolução CFP 06/2019]`.

---

## 🎯 5. Ideias & Backlog para Evolução Futura

1. **Hospedagem & Deploy de Alta Performance:**
   * A Landing Page pode ser publicada isoladamente no **Cloudflare Pages**, **Vercel** ou **Netlify**, com custo zero e deploy contínuo via GitHub.
2. **Domínio Próprio & SEO Avançado:**
   * Apontamento para domínio oficial (ex.: `synapsiclinico.com.br`).
   * Validação de Rich Snippets no Google Search Console.
3. **Analytics & Tracking:**
   * Inserção de tags do Google Tag Manager, Google Analytics 4 e Meta Pixel nos botões de clique para o WhatsApp.