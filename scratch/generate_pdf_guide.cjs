const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const logoPath = path.join(rootDir, 'landing', 'synapsi_brain1.png');
const outputHtml = path.join(rootDir, 'scratch', 'guia_impressao.html');
const outputPdf = path.join(rootDir, 'docs', 'GUIA_DECISAO_COMERCIAL_SYNAPSIS_VS_PSICOMANAGER.pdf');

// Ler o logo e converter para Base64
let logoBase64 = '';
if (fs.existsSync(logoPath)) {
  const logoBuffer = fs.readFileSync(logoPath);
  logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
}

const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Synapsis Clínico vs. PsicoManager — Guia Executivo de Decisão</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    @page {
      size: A4;
      margin: 12mm 14mm 14mm 14mm;
      @bottom-right {
        content: counter(page);
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 11.5px;
      line-height: 1.5;
    }

    /* Utilitários de Quebra */
    .page-break {
      page-break-after: always;
      break-after: page;
    }
    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Cabeçalho Executivo */
    .header-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      width: 44px;
      height: 44px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(13, 148, 136, 0.25));
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
    }
    .brand-title span {
      color: #0d9488;
    }
    .brand-tagline {
      font-size: 9.5px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    .badge-doc {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      color: #0f766e;
      font-size: 9px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      display: inline-block;
      text-align: right;
    }

    /* Títulos */
    h1 {
      font-size: 17px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 4px;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 11px;
      color: #475569;
      font-weight: 500;
      margin-bottom: 14px;
    }
    h2 {
      font-size: 13.5px;
      font-weight: 700;
      color: #0f172a;
      border-left: 3.5px solid #0d9488;
      padding-left: 8px;
      margin: 16px 0 10px 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    h3 {
      font-size: 11.5px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 4px;
    }

    /* Sumário e Pilares Rápidos */
    .summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 11px;
      color: #334155;
    }
    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .pillar-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px 10px;
      border-top: 3px solid #0d9488;
    }
    .pillar-card-title {
      font-size: 10.5px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .pillar-card-desc {
      font-size: 9.5px;
      color: #64748b;
      line-height: 1.35;
    }

    /* Tabelas Executivas */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 14px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      text-align: left;
      padding: 7px 9px;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #1e293b;
    }
    th.th-synapsis {
      background: #0f766e;
      color: #ffffff;
    }
    th.th-psico {
      background: #334155;
      color: #f1f5f9;
    }
    td {
      padding: 6px 9px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
      line-height: 1.35;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge-check {
      background: #dcfce7;
      color: #15803d;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9px;
      white-space: nowrap;
    }
    .badge-warn {
      background: #fef3c7;
      color: #b45309;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9px;
      white-space: nowrap;
    }
    .badge-cross {
      background: #fee2e2;
      color: #b91c1c;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 9px;
      white-space: nowrap;
    }

    /* Detalhamento dos Pilares */
    .pillar-section {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
    }
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 6px;
    }
    .pain-box {
      background: #fff1f2;
      border-left: 3px solid #e11d48;
      border-radius: 4px;
      padding: 8px 10px;
      font-size: 10px;
      color: #881337;
    }
    .solution-box {
      background: #f0fdfa;
      border-left: 3px solid #0d9488;
      border-radius: 4px;
      padding: 8px 10px;
      font-size: 10px;
      color: #134e4a;
    }
    .solution-list {
      margin-left: 14px;
      margin-top: 4px;
    }
    .solution-list li {
      margin-bottom: 2px;
    }

    /* Bloco de ROI */
    .roi-banner {
      background: linear-gradient(135deg, #042f2e 0%, #0f172a 100%);
      color: #ffffff;
      border-radius: 8px;
      padding: 12px 16px;
      margin: 12px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .roi-stat-title {
      font-size: 10px;
      text-transform: uppercase;
      color: #99f6e4;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .roi-stat-value {
      font-size: 17px;
      font-weight: 800;
      color: #ffffff;
    }
    .roi-stat-sub {
      font-size: 9px;
      color: #cbd5e1;
    }

    /* Migração em 3 Passos */
    .steps-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 10px 0 14px 0;
    }
    .step-item {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      position: relative;
    }
    .step-number {
      position: absolute;
      top: -9px;
      left: 10px;
      background: #0d9488;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 9999px;
    }
    .step-text {
      margin-top: 4px;
      font-size: 10px;
      color: #334155;
    }

    /* Checklist */
    .checklist-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 12px;
    }
    .check-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 6px 8px;
      font-size: 9.5px;
      color: #334155;
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }
    .check-box-icon {
      width: 12px;
      height: 12px;
      border: 1.5px solid #0d9488;
      border-radius: 2px;
      flex-shrink: 0;
      margin-top: 1.5px;
    }

    /* Call to Action Final */
    .cta-banner {
      background: #f0fdfa;
      border: 1.5px solid #0d9488;
      border-radius: 8px;
      padding: 12px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
    }
    .cta-content h4 {
      font-size: 12px;
      font-weight: 800;
      color: #0f766e;
    }
    .cta-content p {
      font-size: 10px;
      color: #334155;
    }
    .cta-contacts {
      text-align: right;
      font-size: 10px;
      color: #0f172a;
      font-weight: 600;
    }
    .cta-contacts strong {
      color: #0d9488;
    }

    /* Rodapé */
    .footer-note {
      font-size: 8.5px;
      color: #94a3b8;
      text-align: center;
      margin-top: 10px;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
    }
  </style>
</head>
<body>

  <!-- PÁGINA 1: IDENTIDADE, SUMÁRIO EXECUTIVO & QUADRO COMPARATIVO COMPLETO -->
  <div class="header-banner">
    <div class="brand-box">
      ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo" alt="Synapsis Logo">` : ''}
      <div>
        <div class="brand-title">SYNAPSIS <span>CLÍNICO</span></div>
        <div class="brand-tagline">Inteligência Operacional & Prontuário Pericial para Psicologia</div>
      </div>
    </div>
    <div class="badge-doc">
      Documento Oficial de Decisão<br>
      <strong>Uso Executivo & Comercial</strong>
    </div>
  </div>

  <h1>Synapsis Clínico vs. PsicoManager: Guia Executivo de Decisão</h1>
  <div class="subtitle">Análise Comparativa de Arquitetura, Blindagem Financeira, Avaliação Neuropsicológica e Custo Total de Propriedade (TCO)</div>

  <div class="summary-box">
    <strong>Sumário Executivo:</strong> A escolha do ecossistema central de uma clínica multiprofissional transcende agendas e cadastros: impacta diretamente a <strong>blindagem contra inadimplência</strong>, a <strong>paz contábil no repasse de honorários</strong>, o <strong>cumprimento da Resolução CFP 06/2019</strong> e a <strong>agilidade da recepção</strong>. Enquanto sistemas legados como o PsicoManager mantêm dependência de baixas manuais e pacotes extras de WhatsApp, o <strong>Synapsis Clínico</strong> oferece infraestrutura pericial com conciliação automática via Asaas Webhook, migrador nativo em 1 clique e módulo completo de neuropsicologia.
  </div>

  <div class="pillars-grid">
    <div class="pillar-card">
      <div class="pillar-card-title">⚡ Conciliação Asaas Webhook</div>
      <div class="pillar-card-desc">Baixa bancária em tempo real sem conferir comprovantes ou extratos bancários.</div>
    </div>
    <div class="pillar-card">
      <div class="pillar-card-title">🚀 Migrador 1-Clique</div>
      <div class="pillar-card-desc">Importação direta da planilha do PsicoManager com saneamento algorítmico de CPFs.</div>
    </div>
    <div class="pillar-card">
      <div class="pillar-card-title">🛡️ Repasse Blindado</div>
      <div class="pillar-card-desc">Honorários gerados exclusivamente sobre sessões quitadas. Extrato timbrado em PDF.</div>
    </div>
    <div class="pillar-card">
      <div class="pillar-card-title">🧠 Neuropsicologia Nativa</div>
      <div class="pillar-card-desc">Controle de baterias de testes (WISC, WAIS), percentis e laudos CID-11 / DSM-5.</div>
    </div>
    <div class="pillar-card">
      <div class="pillar-card-title">🔒 Prontuário Pericial</div>
      <div class="pillar-card-desc">Hash imutável SHA-256 (CFP 06/2019) e criptografia de dados em repouso AES-256.</div>
    </div>
    <div class="pillar-card">
      <div class="pillar-card-title">💎 Zero Custos Ocultos</div>
      <div class="pillar-card-desc">WhatsApp ilimitado nativo, recepcionistas grátis e plano clínica agressivo de R$ 119,90/mês.</div>
    </div>
  </div>

  <h2>1. Quadro Sinóptico de Diferenciais Inegociáveis</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Dimensão Avaliada</th>
        <th class="th-synapsis" style="width: 22%; text-align: center;">🧠 Synapsis Clínico</th>
        <th class="th-psico" style="width: 20%; text-align: center;">🏢 PsicoManager</th>
        <th style="width: 30%;">Veredito Estratégico & Impacto</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Conciliação Bancária Automática (Asaas Webhook)</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Nativa e em Tempo Real</span></td>
        <td style="text-align: center;"><span class="badge-cross">❌ Manual / Fragmentada</span></td>
        <td><strong>Zero Atrito:</strong> Paciente paga o PIX e a recepção vê o status "PAGO" em segundos, sem cobrar prints.</td>
      </tr>
      <tr>
        <td><strong>Migrador Dedicado do PsicoManager</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Nativo em 1 Clique (CSV)</span></td>
        <td style="text-align: center;"><span class="badge-warn">⚠️ Exportação simples</span></td>
        <td><strong>Troca sem Dor:</strong> Saneia CPFs na Receita Federal e mapeia múltiplos responsáveis sem redigitação.</td>
      </tr>
      <tr>
        <td><strong>Repasse APENAS sobre sessões pagas</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Nativo (Regra de Ouro)</span></td>
        <td style="text-align: center;"><span class="badge-warn">⚠️ Relatório simples</span></td>
        <td><strong>Blindagem de Caixa:</strong> A clínica nunca adianta honorários de consultas não quitadas pelo paciente.</td>
      </tr>
      <tr>
        <td><strong>Extrato Timbrado em PDF com Chave PIX</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ 1 Clique (Jurídico)</span></td>
        <td style="text-align: center;"><span class="badge-cross">❌ Apenas tabela CSV</span></td>
        <td><strong>Paz Contábil:</strong> Documento com quitação recíproca assinada, eliminando atritos no fim do mês.</td>
      </tr>
      <tr>
        <td><strong>Portal do Terapeuta ("Minha Produtividade")</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Zero-Knowledge</span></td>
        <td style="text-align: center;"><span class="badge-warn">⚠️ Relatórios da gerência</span></td>
        <td><strong>Transparência com Sigilo:</strong> O psicólogo vê seus recebíveis sem acessar o faturamento global da clínica.</td>
      </tr>
      <tr>
        <td><strong>Módulo de Avaliação Neuropsicológica</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Nativo e Completo</span></td>
        <td style="text-align: center;"><span class="badge-cross">❌ Inexistente</span></td>
        <td><strong>Exclusividade:</strong> Gestão de baterias de testes psicométricos, percentis e laudos CID-11 / DSM-5.</td>
      </tr>
      <tr>
        <td><strong>Imutabilidade CFP com Hash SHA-256</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Grau Pericial</span></td>
        <td style="text-align: center;"><span class="badge-cross">❌ Log comum de banco</span></td>
        <td><strong>Blindagem Ética:</strong> Prova matemática de não adulteração retroativa perante o Conselho (CRP) e Judiciário.</td>
      </tr>
      <tr>
        <td><strong>Criptografia em Repouso AES-256-GCM</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Cifrado em Repouso</span></td>
        <td style="text-align: center;"><span class="badge-warn">⚠️ HTTPS apenas em trânsito</span></td>
        <td><strong>Conformidade LGPD:</strong> Prontuários e dados hipersensíveis invioláveis contra vazamentos.</td>
      </tr>
      <tr>
        <td><strong>Roteamento de Mensagens para Menores</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Pai, Mãe ou Tutor</span></td>
        <td style="text-align: center;"><span class="badge-cross">❌ Disparo único</span></td>
        <td><strong>Segurança Ética:</strong> Impede cobranças ou confirmações indevidas no celular de pacientes crianças.</td>
      </tr>
      <tr>
        <td><strong>Disparos de WhatsApp sem Limites</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ 100% Ilimitado</span></td>
        <td style="text-align: center;"><span class="badge-warn">⚠️ Cobrança de Créditos</span></td>
        <td><strong>Previsibilidade:</strong> Sem risco de bloqueios de disparos no meio do mês por término de franquia.</td>
      </tr>
      <tr>
        <td><strong>Acessos de Secretárias / Recepção</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ Ilimitados e Gratuitos</span></td>
        <td style="text-align: center;"><span class="badge-warn">⚠️ Acessos limitados</span></td>
        <td><strong>Multi-turnos sem taxa:</strong> Aumente sua equipe de atendimento sem custo extra de licença.</td>
      </tr>
      <tr>
        <td><strong>Período de Degustação / Teste</strong></td>
        <td style="text-align: center;"><span class="badge-check">✅ 14 Dias (Sem Cartão)</span></td>
        <td style="text-align: center;"><span class="badge-warn">⚠️ 7 Dias</span></td>
        <td>O dobro de prazo para migrar e validar a rotina com os profissionais parceiros.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-note">
    Synapsis Clínico © 2026 — Inteligência Clínica & Gestão de Alta Performance. Página 1 de 2
  </div>

  <!-- PÁGINA 2: OS 5 PILARES, ROI FINANCEIRO, MIGRAÇÃO & CHECKLIST -->
  <div class="page-break"></div>

  <div class="header-banner">
    <div class="brand-box">
      ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo" alt="Synapsis Logo">` : ''}
      <div>
        <div class="brand-title">SYNAPSIS <span>CLÍNICO</span></div>
        <div class="brand-tagline">Inteligência Operacional & Prontuário Pericial para Psicologia</div>
      </div>
    </div>
    <div class="badge-doc">
      Dossiê Comparativo & ROI<br>
      <strong>Página 2</strong>
    </div>
  </div>

  <h2>2. Aprofundamento dos 5 Pilares de Diferenciação Técnica</h2>

  <div class="pillar-section avoid-break">
    <h3>Pilar 1: Cobrança Inteligente Asaas & Baixa Automática via Webhook</h3>
    <div class="comparison-grid">
      <div class="pain-box">
        <strong>No PsicoManager:</strong> A recepção envia a cobrança e precisa exigir prints de comprovantes PIX. Ao fim do dia, a equipe perde 1 hora checando o extrato bancário manualmente antes de dar baixa.
      </div>
      <div class="solution-box">
        <strong>No Synapsis Clínico:</strong>
        <ul class="solution-list">
          <li>QR Code PIX dinâmico com valor exato enviado pelo WhatsApp em 1 clique.</li>
          <li>Webhook instantâneo: paciente pagou no app do banco, o status vira <strong>PAGO (Verde)</strong> na recepção em segundos, liberando emissão de NFS-e e cálculo de repasse.</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="pillar-section avoid-break">
    <h3>Pilar 2: Migrador Nativo do PsicoManager em 1 Clique (Troca sem Dor)</h3>
    <div class="comparison-grid">
      <div class="pain-box">
        <strong>A Objeção Clássica:</strong> <em>"Tenho centenas de pacientes no PsicoManager e receio o desgaste de digitar tudo de novo."</em>
      </div>
      <div class="solution-box">
        <strong>No Synapsis Clínico:</strong>
        <ul class="solution-list">
          <li>Exportação oficial do PsicoManager em CSV e importação imediata em lote no Synapsis.</li>
          <li>Validação algorítmica de CPFs na Receita Federal e separação inteligente de menores e responsáveis pagadores.</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="pillar-section avoid-break">
    <h3>Pilar 3: Fim das Planilhas de Rateio & Blindagem contra Calotes</h3>
    <div class="comparison-grid">
      <div class="pain-box">
        <strong>No PsicoManager:</strong> Relatórios simples de atendimentos sem trava contra inadimplência, induzindo a clínica a adiantar comissões de consultas não pagas.
      </div>
      <div class="solution-box">
        <strong>No Synapsis Clínico:</strong>
        <ul class="solution-list">
          <li><strong>Regra de Ouro:</strong> Nenhuma comissão é calculada sobre consultas em aberto.</li>
          <li>Fechamento formal de Lotes (<code>LOTE-2026-09-001</code>) e emissão de extrato timbrado em PDF com chave PIX e quitação jurídica mútua.</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="pillar-section avoid-break">
    <h3>Pilar 4: O Único com Neuropsicologia Nativa no Brasil</h3>
    <div class="comparison-grid">
      <div class="pain-box">
        <strong>No PsicoManager:</strong> Inexistência de suporte neuropsicológico. Avaliações complexas precisam ser controladas em cadernos e planilhas paralelas.
      </div>
      <div class="solution-box">
        <strong>No Synapsis Clínico:</strong>
        <ul class="solution-list">
          <li>Gestão de pacotes neuro (anamnese, testagens, entrevistas e devolutiva).</li>
          <li>Baterias psicométricas (WISC, WAIS, Neupsilin) com cálculo de percentis e laudos CID-11/DSM-5.</li>
        </ul>
      </div>
    </div>
  </div>

  <h2>3. Simulação de ROI em 12 Meses (Clínica com 8 Profissionais Parceiros)</h2>
  
  <table class="avoid-break" style="margin-bottom: 8px;">
    <thead>
      <tr>
        <th>Componente Operacional</th>
        <th class="th-synapsis" style="text-align: center;">🧠 Synapsis Clínico (Anual)</th>
        <th class="th-psico" style="text-align: center;">🏢 PsicoManager (Plano Clínica)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Assinatura Base (até 5 profissionais)</strong></td>
        <td style="text-align: center;"><strong>R$ 119,90 / mês</strong> (Entrada Agressiva)</td>
        <td style="text-align: center;">~R$ 129,90 a R$ 159,00 / mês</td>
      </tr>
      <tr>
        <td><strong>3 Psicólogos Extras (6º, 7º e 8º)</strong></td>
        <td style="text-align: center;">R$ 75,00 / mês (3x R$ 25,00 fixos)</td>
        <td style="text-align: center;">R$ 105,00 a R$ 135,00 / mês</td>
      </tr>
      <tr>
        <td><strong>Pacotes Adicionais de WhatsApp</strong></td>
        <td style="text-align: center;"><strong>R$ 0,00</strong> (100% incluso nativo)</td>
        <td style="text-align: center;">~R$ 50,00 a R$ 80,00 / mês</td>
      </tr>
      <tr>
        <td><strong>Cobrança & Baixa Bancária Automática</strong></td>
        <td style="text-align: center;"><strong>Inclusa via Asaas Webhook</strong></td>
        <td style="text-align: center;">Manual (Consome 1h/dia da secretária)</td>
      </tr>
      <tr style="background: #f1f5f9; font-weight: 700;">
        <td><strong>CUSTO MENSAL TOTAL ESTIMADO</strong></td>
        <td style="text-align: center; color: #0f766e; font-size: 11px;">R$ 194,90 / mês</td>
        <td style="text-align: center; color: #b91c1c; font-size: 11px;">R$ 284,90 a R$ 374,00 / mês</td>
      </tr>
      <tr style="background: #e2e8f0; font-weight: 800;">
        <td><strong>INVESTIMENTO ANUAL EM SOFTWARE</strong></td>
        <td style="text-align: center; color: #0f766e; font-size: 12px;">R$ 2.338,80 / ano</td>
        <td style="text-align: center; color: #b91c1c; font-size: 12px;">R$ 3.418,00 a R$ 4.488,00 / ano</td>
      </tr>
    </tbody>
  </table>

  <div class="roi-banner avoid-break">
    <div>
      <div class="roi-stat-title">Economia em Licença</div>
      <div class="roi-stat-value">+ R$ 2.149 / ano</div>
      <div class="roi-stat-sub">Preço base R$ 119,90 e sem recargas de WhatsApp</div>
    </div>
    <div style="border-left: 1px solid rgba(255,255,255,0.2); padding-left: 14px;">
      <div class="roi-stat-title">Blindagem Anti-Calote</div>
      <div class="roi-stat-value">+ R$ 3.000 / ano</div>
      <div class="roi-stat-sub">Zero adiantamento de honorários não quitados</div>
    </div>
    <div style="border-left: 1px solid rgba(255,255,255,0.2); padding-left: 14px;">
      <div class="roi-stat-title">Tempo de Recepção</div>
      <div class="roi-stat-value">+ 200 Horas / ano</div>
      <div class="roi-stat-sub">Baixa automática Asaas e extrato em 1 clique</div>
    </div>
  </div>

  <div class="avoid-break">
    <h2>4. Transição Suave em 3 Passos & Checklist de Decisão</h2>
    
    <div class="steps-container">
      <div class="step-item">
        <div class="step-number">Passo 1</div>
        <div class="step-text"><strong>Exportar Backup PsicoManager:</strong> A clínica baixa a planilha oficial de pacientes (Art. 18 LGPD).</div>
      </div>
      <div class="step-item">
        <div class="step-number">Passo 2</div>
        <div class="step-text"><strong>Importador 1-Clique Synapsis:</strong> Sobe o arquivo no sistema; CPFs e responsáveis são saneados em 1 minuto.</div>
      </div>
      <div class="step-item">
        <div class="step-number">Passo 3</div>
        <div class="step-text"><strong>Coexistência Segura:</strong> Atenda no Synapsis em paralelo. Só cancele o antigo quando estiver 100% seguro.</div>
      </div>
    </div>

    <div class="checklist-grid">
      <div class="check-item"><div class="check-box-icon"></div><span>Seu sistema atual dá baixa automática via Webhook sem pedir comprovante de PIX?</span></div>
      <div class="check-item"><div class="check-box-icon"></div><span>Você consegue migrar seus pacientes com 1 clique através de um importador dedicado?</span></div>
      <div class="check-item"><div class="check-box-icon"></div><span>Seu sistema garante que você NUNCA repassa honorários sobre sessões não pagas?</span></div>
      <div class="check-item"><div class="check-box-icon"></div><span>Você emite extrato timbrado em PDF com chave PIX e quitação assinada em 1 clique?</span></div>
      <div class="check-item"><div class="check-box-icon"></div><span>Sua clínica gerencia baterias de testes psicométricos e laudos CID-11 nativamente?</span></div>
      <div class="check-item"><div class="check-box-icon"></div><span>Seus prontuários possuem assinatura Hash SHA-256 de grau pericial exigido pelo CFP?</span></div>
    </div>

    <div class="cta-banner">
      <div class="cta-content">
        <h4>Avalie na Prática na Sua Clínica</h4>
        <p>Experimente por <strong>14 dias sem cartão</strong> ou solicite uma demonstração guiada de 15 minutos.</p>
      </div>
      <div class="cta-contacts">
        WhatsApp Comercial: <strong>(11) 99999-8888</strong><br>
        E-mail: <strong>contato@synapsisclinico.com.br</strong>
      </div>
    </div>

    <div class="footer-note">
      Synapsis Clínico — Material Oficial de Apoio Comercial. Documento confidencial destinado à diretoria clínica. Página 2 de 2.
    </div>
  </div>

</body>
</html>`;

fs.writeFileSync(outputHtml, htmlContent, 'utf-8');
console.log(`HTML temporário gerado com sucesso em: ${outputHtml}`);

// Caminho do Chrome
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserPath = fs.existsSync(chromePath) ? chromePath : edgePath;

const cmd = `"${browserPath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${outputPdf}" "file:///${outputHtml.replace(/\\\\/g, '/')}"`;

console.log('Executando comando de conversão para PDF...');
execSync(cmd);

if (fs.existsSync(outputPdf)) {
  const stats = fs.statSync(outputPdf);
  console.log(`PDF gerado com SUCESSO! Tamanho: ${stats.size} bytes em ${outputPdf}`);
} else {
  console.error('Erro: o PDF não foi encontrado após o comando.');
  process.exit(1);
}
