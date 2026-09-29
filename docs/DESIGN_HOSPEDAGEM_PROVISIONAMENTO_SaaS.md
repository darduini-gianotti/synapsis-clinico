# Arquitetura de Hospedagem e Provisionamento SaaS (Synapsis Clínico / PsicoGestão)

**Data da Decisão:** 19 de Setembro de 2026
**Fase do Projeto:** Lançamento GTM (15 a 100 primeiras clínicas)

## 1. Resumo do Entendimento (Understanding Lock)
- **O que será construído:** Arquitetura de provisionamento de contas e bancos de dados para o SaaS de psicologia.
- **Restrições Chave:** O cadastro deve ser instantâneo para a psicóloga na Landing Page. O isolamento de prontuários precisa respeitar o CFP e a LGPD rigorosamente.
- **Infraestrutura:** Necessidade de baixo custo inicial (lidando com "leigos" em gestão de servidores), mas pronta para picos de demanda.

## 2. Premissas Técnicas (Assumptions)
- **Escala:** Suporte a 500 bancos de dados simultâneos sem custo inicial substancial.
- **Banco de Dados:** Utilização de `Database-per-tenant` usando SQLite.
- **Hospedagem:** Stack serverless/gerenciado para remover a necessidade de manutenção de hardware e Linux.

## 3. Log de Decisões (Decision Log)
1. **Banco por Clínica:** Escolhido o isolamento físico (um arquivo SQLite gerenciado no Turso por clínica) em vez de banco multi-tenant único, devido à fortíssima camada de segurança gerada para marketing (LGPD).
2. **Automação Total:** Escolhido o provisionamento via APIs. No segundo em que o usuário preenche a tela da Landing Page, o Backend cria o banco no Turso e a subconta no Asaas.
3. **Plataforma Nuvem:** Escolhido Turso + Vercel/Railway para abater o custo fixo e garantir que a aplicação não saia do ar caso o tráfego da Fase 2 (Meta Ads) exploda.
4. **Política de Inadimplência:** Congelamento do banco (bloqueio de escrita, permissão de leitura em PDF), garantindo a guarda legal de 5 anos do CFP com custo marginal zero de disco.

## 4. O Fluxo de Roteamento Dinâmico (Design Final)
- A clínica fará login utilizando e-mail e senha.
- O sistema autentica contra o **Banco Mestre** e emite um Token (JWT) contendo o `tenant_id` (ex: `clinica_777`).
- Durante o uso do app, todas as rotas do backend leem o Token e conectam o ORM/QueryBuilder exclusivamente na URL segura do Turso daquele *tenant_id*.
- Bugs de aplicação ou injeções são isoladas fisicamente, impossibilitando que a Clínica A busque o CPF de um paciente da Clínica B.

---

## 5. Adendo Estratégico & Provedor de Nuvem Definitivo (26 de Setembro de 2026)
- **Provedor Homologado:** **Amazon Web Services (AWS)**.
- **Localização Física:** Região **São Paulo, Brasil (`sa-east-1`)**.
- **Modalidade de Execução Inicial:** **AWS Lightsail** (custo fixo previsível de $5 a $10/mês, 1 vCPU, 1 GB RAM, SSD NVMe de alta performance e snapshots diários automatizados).
- **Justificativa Comercial & Regulatória:**
  1. **Autoridade de Marca:** Elimina objeções de segurança junto a psicólogos e diretores de clínicas com selo de padrão bancário/hospitalar.
  2. **Soberania Nacional & LGPD (Artigo 33):** Os prontuários e dados clínicos não saem do território brasileiro.
  3. **Latência Ultrabaixa:** 15 a 30ms em conexões nacionais.
  4. **Guarda Legal de 5 Anos (CFP):** Snapshots automáticos redundantes com retenção legal garantida a custo marginal irrisório.
