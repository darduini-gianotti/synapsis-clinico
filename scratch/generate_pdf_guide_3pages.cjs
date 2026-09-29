const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const logoPath = path.join(rootDir, 'landing', 'synapsi_brain1.png');
const outputHtml = path.join(rootDir, 'scratch', 'guia_impressao_3paginas.html');
const outputPdfV2 = path.join(rootDir, 'docs', 'GUIA_DECISAO_COMERCIAL_SYNAPSIS_VS_PSICOMANAGER_V2_3PAGINAS.pdf');
const outputPdfMain = path.join(rootDir, 'docs', 'GUIA_DECISAO_COMERCIAL_SYNAPSIS_VS_PSICOMANAGER.pdf');

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
  <title>Synapsis Clínico vs. PsicoManager — Guia Executivo de Decisão (Versão 3 Páginas com Academy)</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    @page {
      size: A4 portrait;
      margin: 9mm 12mm 9mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 10px;
      line-height: 1.4;
    }

    /* Container estrito de cada página A4 */
    .page-container {
      width: 100%;
      height: 279mm;
      max-height: 279mm;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
    }

    .page-container:last-child {
      page-break-after: auto;
      break-after: auto;
    }

    /* Cabeçalho Executivo */
    .header-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #0d9488;
      padding-bottom: 7px;
      margin-bottom: 10px;
    }
    .brand-box {
      display: flex;
      align-items: center;
      gap: 11px;
    }
    .brand-logo {
      width: 42px;
      height: 42px;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(13, 148, 136, 0.25));
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
      line-height: 1.1;
    }
    .brand-title span {
      color: #0d9488;
    }
    .brand-tagline {
      font-size: 8.5px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.7px;
    }
    .badge-doc {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      color: #0f766e;
      font-size: 8.5px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      text-align: right;
      line-height: 1.25;
    }

    /* Títulos */
    h1 {
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.25;
      margin-bottom: 2px;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 9.5px;
      color: #475569;
      font-weight: 600;
      margin-bottom: 8px;
    }
    h2 {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
      border-left: 3.5px solid #0d9488;
      padding-left: 7px;
      margin: 10px 0 7px 0;
      display: flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    /* Sumário e Pilares Rápidos */
    .summary-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 8px 11px;
      margin-bottom: 8px;
      font-size: 9.2px;
      color: #334155;
      line-height: 1.4;
    }
    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
      margin-bottom: 9px;
    }
    .pillar-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 8px;
      border-top: 3px solid #0d9488;
    }
    .pillar-card-title {
      font-size: 9px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .pillar-card-desc {
      font-size: 8px;
      color: #64748b;
      line-height: 1.3;
    }

    /* Tabelas Executivas */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.8px;
      margin-bottom: 5px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-align: left;
      padding: 4.5px 6px;
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
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
      padding: 3.6px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
      line-height: 1.25;
    }
    tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .badge-check {
      background: #dcfce7;
      color: #15803d;
      font-weight: 700;
      padding: 1.5px 5px;
      border-radius: 4px;
      font-size: 8.2px;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-warn {
      background: #fef3c7;
      color: #b45309;
      font-weight: 600;
      padding: 1.5px 5px;
      border-radius: 4px;
      font-size: 8.2px;
      display: inline-block;
      white-space: nowrap;
    }
    .badge-cross {
      background: #fee2e2;
      color: #b91c1c;
      font-weight: 600;
      padding: 1.5px 5px;
      border-radius: 4px;
      font-size: 8.2px;
      display: inline-block;
      white-space: nowrap;
    }

    /* PÁGINA 2: GRID DOS 6 PILARES */
    .pillars-detailed-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 6px;
    }
    .pillar-section {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 7px 10px;
    }
    .pillar-section-header {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 5px;
    }
    .comparison-grid {
      display: grid;
      grid-template-columns: 1fr 1.35fr;
      gap: 7px;
    }
    .pain-box {
      background: #fff1f2;
      border-left: 2.5px solid #e11d48;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 8.2px;
      color: #881337;
      line-height: 1.3;
    }
    .solution-box {
      background: #f0fdfa;
      border-left: 2.5px solid #0d9488;
      border-radius: 4px;
      padding: 5px 8px;
      font-size: 8.2px;
      color: #134e4a;
      line-height: 1.3;
    }
    .solution-list {
      margin-left: 10px;
      margin-top: 3px;
    }
    .solution-list li {
      margin-bottom: 1.5px;
    }

    /* PÁGINA 3: ROI, TRANSIÇÃO & DECISÃO */
    .roi-banner {
      background: linear-gradient(135deg, #042f2e 0%, #0f172a 100%);
      color: #ffffff;
      border-radius: 7px;
      padding: 6px 12px;
      margin: 5px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .roi-stat-title {
      font-size: 8px;
      text-transform: uppercase;
      color: #99f6e4;
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .roi-stat-value {
      font-size: 14px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.15;
    }
    .roi-stat-sub {
      font-size: 7.2px;
      color: #cbd5e1;
    }

    /* Migração em 3 Passos */
    .steps-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin: 4px 0 6px 0;
    }
    .step-item {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 5px 8px;
      position: relative;
    }
    .step-number {
      position: absolute;
      top: -6px;
      left: 8px;
      background: #0d9488;
      color: #ffffff;
      font-size: 7px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 9999px;
    }
    .step-text {
      margin-top: 2px;
      font-size: 8px;
      color: #334155;
      line-height: 1.25;
    }

    /* Checklist */
    .checklist-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-bottom: 5px;
    }
    .check-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 3.5px 6px;
      font-size: 7.8px;
      color: #334155;
      display: flex;
      align-items: flex-start;
      gap: 5px;
      line-height: 1.2;
    }
    .check-box-icon {
      width: 10px;
      height: 10px;
      border: 1.5px solid #0d9488;
      border-radius: 2px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Call to Action Final */
    .cta-banner {
      background: #f0fdfa;
      border: 1.5px solid #0d9488;
      border-radius: 7px;
      padding: 7px 11px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 4px;
    }
    .cta-content h4 {
      font-size: 10px;
      font-weight: 800;
      color: #0f766e;
    }
    .cta-content p {
      font-size: 8.5px;
      color: #334155;
    }
    .cta-contacts {
      text-align: right;
      font-size: 8.5px;
      color: #0f172a;
      font-weight: 600;
    }
    .cta-contacts strong {
      color: #0d9488;
    }

    /* Rodapé */
    .footer-note {
      font-size: 7.8px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 5px;
      margin-top: auto;
    }
  </style>
</head>
<body>

  <!-- ==================== PÁGINA 1: QUADRO SINÓPTICO & DIFERENCIAIS ==================== -->
  <div class="page-container">
    <div>
      <div class="header-banner">
        <div class="brand-box">
          ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo" alt="Synapsis Logo">` : ''}
          <div>
            <div class="brand-title">SYNAPSIS <span>CLÍNICO</span></div>
            <div class="brand-tagline">Inteligência Operacional, Prontuário Pericial & Neuropsicologia</div>
          </div>
        </div>
        <div class="badge-doc">
          Dossiê Oficial de Decisão<br>
          <strong>Uso Estratégico & Comercial</strong>
        </div>
      </div>

      <h1>Synapsis Clínico vs. PsicoManager: Guia Executivo de Decisão</h1>
      <div class="subtitle">Análise Comparativa de Arquitetura, Blindagem Financeira, Avaliação Neuropsicológica, Onboarding e TCO</div>

      <div class="summary-box">
        <strong>Sumário Executivo:</strong> A escolha do software central de uma clínica multiprofissional transcende agendas e cadastros: impacta diretamente a <strong>segurança jurídica frente ao CFP</strong>, a <strong>blindagem contra inadimplência</strong>, a <strong>paz contábil no repasse de honorários</strong> e a <strong>capacitação rápida da equipe</strong>. Enquanto sistemas legados mantêm dependência de conferências bancárias manuais, recargas de créditos de WhatsApp e manuais de texto estáticos, o <strong>Synapsis Clínico</strong> oferece infraestrutura pericial com conciliação automática via Asaas Webhook, migrador nativo do PsicoManager em 1 clique, módulo completo de neuropsicologia e a inovadora <strong>Synapsis Academy</strong> para onboarding interativo sem risco à clínica real.
      </div>

      <div class="pillars-grid">
        <div class="pillar-card">
          <div class="pillar-card-title">⚡ Asaas Webhook</div>
          <div class="pillar-card-desc">Baixa bancária em tempo real sem pedir comprovante de PIX pelo WhatsApp.</div>
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
          <div class="pillar-card-desc">Controle de baterias psicométricas (WISC, WAIS), percentis e laudos CID-11 / DSM-5.</div>
        </div>
        <div class="pillar-card">
          <div class="pillar-card-title">🔒 Prontuário Pericial</div>
          <div class="pillar-card-desc">Hash imutável SHA-256 (CFP 06/2019) e criptografia AES-256-GCM em repouso.</div>
        </div>
        <div class="pillar-card">
          <div class="pillar-card-title">🎓 Synapsis Academy</div>
          <div class="pillar-card-desc">Treinamento prático em Sandbox seguro: capacitação de secretárias em 15 minutos.</div>
        </div>
      </div>

      <h2>1. Quadro Sinóptico de Diferenciais Inegociáveis</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 27%;">Dimensão Avaliada</th>
            <th class="th-synapsis" style="width: 21%; text-align: center;">🧠 Synapsis Clínico</th>
            <th class="th-psico" style="width: 20%; text-align: center;">🏢 PsicoManager</th>
            <th style="width: 32%;">Veredito Estratégico & Impacto na Operação</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Conciliação Bancária Automática (Asaas Webhook)</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ Nativa e em Tempo Real</span></td>
            <td style="text-align: center;"><span class="badge-cross">❌ Manual / Fragmentada</span></td>
            <td><strong>Zero Atrito:</strong> Paciente paga o PIX e a recepção vê o status "PAGO" em segundos, sem cobrar comprovantes.</td>
          </tr>
          <tr>
            <td><strong>Migrador Dedicado do PsicoManager</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ Nativo em 1 Clique (CSV)</span></td>
            <td style="text-align: center;"><span class="badge-warn">⚠️ Exportação simples</span></td>
            <td><strong>Troca sem Dor:</strong> Saneia CPFs na Receita Federal e mapeia múltiplos responsáveis sem digitação do zero.</td>
          </tr>
          <tr>
            <td><strong>Repasse APENAS sobre sessões pagas</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ Nativo (Regra de Ouro)</span></td>
            <td style="text-align: center;"><span class="badge-warn">⚠️ Relatório simples</span></td>
            <td><strong>Blindagem de Caixa:</strong> A clínica nunca adianta honorários de consultas não quitadas pelo paciente.</td>
          </tr>
          <tr>
            <td><strong>Extrato Timbrado em PDF com Chave PIX</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ 1 Clique (Formal/Jurídico)</span></td>
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
            <td><strong>Blindagem Ética:</strong> Prova matemática de não adulteração retroativa perante o CRP e Judiciário.</td>
          </tr>
          <tr>
            <td><strong>Criptografia em Repouso AES-256-GCM</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ Cifrado em Repouso</span></td>
            <td style="text-align: center;"><span class="badge-warn">⚠️ HTTPS apenas em trânsito</span></td>
            <td><strong>Conformidade LGPD:</strong> Prontuários e dados hipersensíveis blindados contra vazamentos.</td>
          </tr>
          <tr>
            <td><strong>Roteamento de Mensagens para Menores</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ Pai, Mãe ou Tutor</span></td>
            <td style="text-align: center;"><span class="badge-cross">❌ Disparo único</span></td>
            <td><strong>Segurança Ética:</strong> Impede envio de cobranças e lembretes para o celular de pacientes crianças.</td>
          </tr>
          <tr>
            <td><strong>Disparos de WhatsApp sem Limites</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ 100% Ilimitado</span></td>
            <td style="text-align: center;"><span class="badge-warn">⚠️ Cobrança de Créditos</span></td>
            <td><strong>Previsibilidade:</strong> Sem risco de bloqueios de disparos no meio do mês por término de pacote.</td>
          </tr>
          <tr>
            <td><strong>Capacitação da Equipe (Synapsis Academy)</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ Nativa em Sandbox Seguro</span></td>
            <td style="text-align: center;"><span class="badge-cross">❌ Apenas vídeos e manuais</span></td>
            <td><strong>Turnover sem Dor:</strong> Novas secretárias treinam em 15 min em ambiente simulado sem risco aos pacientes reais.</td>
          </tr>
          <tr>
            <td><strong>Acessos de Secretárias / Recepção</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ Ilimitados e Gratuitos</span></td>
            <td style="text-align: center;"><span class="badge-warn">⚠️ Acessos limitados</span></td>
            <td><strong>Multi-turnos sem taxa:</strong> Aumente a equipe de atendimento sem custo extra de licença.</td>
          </tr>
          <tr>
            <td><strong>Período de Degustação / Teste</strong></td>
            <td style="text-align: center;"><span class="badge-check">✅ 14 Dias (Sem Cartão)</span></td>
            <td style="text-align: center;"><span class="badge-warn">⚠️ 7 Dias</span></td>
            <td>O dobro de prazo para migrar e validar a rotina com os profissionais parceiros.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer-note">
      Synapsis Clínico © 2026 — Inteligência Operacional & Prontuário Pericial para Psicologia. Documento Confidencial. Página 1 de 3.
    </div>
  </div>

  <!-- ==================== PÁGINA 2: OS 6 PILARES DECISÓRIOS ==================== -->
  <div class="page-container">
    <div>
      <div class="header-banner">
        <div class="brand-box">
          ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo" alt="Synapsis Logo">` : ''}
          <div>
            <div class="brand-title">SYNAPSIS <span>CLÍNICO</span></div>
            <div class="brand-tagline">Dossiê Técnico dos 6 Pilares Decisórios de Engenharia e Gestão</div>
          </div>
        </div>
        <div class="badge-doc">
          Dossiê Técnico Comparativo<br>
          <strong>Página 2 de 3</strong>
        </div>
      </div>

      <h2>2. Aprofundamento dos 6 Pilares de Diferenciação Técnica</h2>
      <div class="pillars-detailed-grid">

        <!-- Pilar 1 -->
        <div class="pillar-section">
          <div class="pillar-section-header">
            <span>⚡ Pilar 1: Cobrança Asaas & Baixa via Webhook</span>
          </div>
          <div class="comparison-grid">
            <div class="pain-box">
              <strong>PsicoManager:</strong> A recepção cobra o paciente e precisa pedir prints de comprovantes PIX. Ao fim do dia, perde 1h checando extrato bancário manualmente.
            </div>
            <div class="solution-box">
              <strong>Synapsis Clínico:</strong>
              <ul class="solution-list">
                <li>QR Code PIX dinâmico enviado em 1 clique via WhatsApp.</li>
                <li>Webhook instantâneo: paciente pagou no app do banco, vira <strong>PAGO</strong> na recepção em segundos sem toque humano.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Pilar 2 -->
        <div class="pillar-section">
          <div class="pillar-section-header">
            <span>🚀 Pilar 2: Migrador PsicoManager em 1 Clique</span>
          </div>
          <div class="comparison-grid">
            <div class="pain-box">
              <strong>Objeção:</strong> <em>"Tenho centenas de pacientes no PsicoManager e o trabalho de cadastrar todo mundo do zero é inviável."</em>
            </div>
            <div class="solution-box">
              <strong>Synapsis Clínico:</strong>
              <ul class="solution-list">
                <li>Upload direto da planilha oficial CSV/Excel do PsicoManager.</li>
                <li>Saneamento algorítmico de CPFs na Receita Federal e separação inteligente de menores e responsáveis pagadores.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Pilar 3 -->
        <div class="pillar-section">
          <div class="pillar-section-header">
            <span>🛡️ Pilar 3: Repasse Blindado Anti-Calote</span>
          </div>
          <div class="comparison-grid">
            <div class="pain-box">
              <strong>PsicoManager:</strong> Relatório simples sem trava de inadimplência. A clínica corre o risco diário de adiantar comissões de consultas não quitadas.
            </div>
            <div class="solution-box">
              <strong>Synapsis Clínico:</strong>
              <ul class="solution-list">
                <li><strong>Regra de Ouro:</strong> Nenhuma comissão é gerada sobre sessões em aberto.</li>
                <li>Fechamento formal de Lotes (<code>LOTE-YYYY-MM-001</code>) e extrato timbrado em PDF com chave PIX e quitação mútua.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Pilar 4 -->
        <div class="pillar-section">
          <div class="pillar-section-header">
            <span>🧠 Pilar 4: Neuropsicologia Nativa no Brasil</span>
          </div>
          <div class="comparison-grid">
            <div class="pain-box">
              <strong>PsicoManager:</strong> Inexistência de módulo neuro. Avaliações complexas são controladas em cadernos e fichas de Word avulsas.
            </div>
            <div class="solution-box">
              <strong>Synapsis Clínico:</strong>
              <ul class="solution-list">
                <li>Controle de pacotes neuro (anamnese, testagem, devolutiva).</li>
                <li>Baterias psicométricas (WISC, WAIS, Neupsilin) com percentis e laudos estruturados CID-11 / DSM-5.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Pilar 5 -->
        <div class="pillar-section">
          <div class="pillar-section-header">
            <span>🔒 Pilar 5: Prontuário Pericial SHA-256 & Matriz de Planos</span>
          </div>
          <div class="comparison-grid">
            <div class="pain-box">
              <strong>PsicoManager:</strong> Histórico simples de banco, créditos extras para WhatsApp e valores sob consulta para terapeutas parceiros.
            </div>
            <div class="solution-box">
              <strong>Synapsis Clínico:</strong>
              <ul class="solution-list">
                <li>Hash SHA-256 irreversível por atendimento (CFP 06/2019) e AES-256-GCM.</li>
                <li>Tríade de planos: <strong>Solo (R$ 69/mês)</strong>, <strong>Parceria PJ (R$ 99/mês c/ NFS-e)</strong> e <strong>Clínica (R$ 129/mês + R$ 25/adicional)</strong>. Secretárias gratuitas inclusas em todos.</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Pilar 6: SYNAPSIS ACADEMY -->
        <div class="pillar-section" style="border-top: 2.5px solid #0d9488;">
          <div class="pillar-section-header">
            <span>🎓 Pilar 6: Synapsis Academy & Treinamento em Sandbox</span>
          </div>
          <div class="comparison-grid">
            <div class="pain-box">
              <strong>PsicoManager:</strong> Treinamento passivo por textos longos e vídeos. O gestor perde dias ensinando novatos e a recepcionista erra com pacientes reais.
            </div>
            <div class="solution-box">
              <strong>Synapsis Clínico:</strong>
              <ul class="solution-list">
                <li><strong>Ambiente Sandbox 100% Seguro:</strong> Dados fictícios para treinar check-in, TV, faturamento e prontuários sem risco real.</li>
                <li><strong>Tours Práticos com Holofote:</strong> Capacita secretárias em 15 minutos com painel de acompanhamento de equipe para o gestor.</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>

    <div class="footer-note">
      Synapsis Clínico © 2026 — Inteligência Operacional & Prontuário Pericial para Psicologia. Documento Confidencial. Página 2 de 3.
    </div>
  </div>

  <!-- ==================== PÁGINA 3: ROI, TRANSIÇÃO SUAVE & DECISÃO FINAL ==================== -->
  <div class="page-container">
    <div>
      <div class="header-banner">
        <div class="brand-box">
          ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo" alt="Synapsis Logo">` : ''}
          <div>
            <div class="brand-title">SYNAPSIS <span>CLÍNICO</span></div>
            <div class="brand-tagline">Simulação de Retorno (ROI), Transição Suave & Avaliação Prática</div>
          </div>
        </div>
        <div class="badge-doc">
          Dossiê Financeiro & Transição<br>
          <strong>Página 3 de 3</strong>
        </div>
      </div>

      <h2>3. Simulação de Retorno sobre Investimento (ROI) em 12 Meses</h2>
      <div style="display: grid; grid-template-columns: 1fr 1.15fr; gap: 6px; margin-bottom: 5px;">
        <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 5px; padding: 4px 7px; font-size: 7.8px; line-height: 1.25;">
          <strong style="color: #0f766e; text-transform: uppercase; font-size: 8px;">Cenário A: Parceria PJ (2 a 3 Profissionais + NFS-e)</strong><br>
          <span style="color: #334155;">PsicoManager obriga plano clínica ou 2-3 contas avulsas (<strong>R$ 178 a R$ 267/mês</strong> sem NFS-e). Na Synapsis (Parceria PJ), custa apenas <strong>R$ 99,00/mês</strong> (Economia de até <strong>R$ 2.016/ano</strong>).</span>
        </div>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 5px; padding: 4px 7px; font-size: 7.8px; line-height: 1.25;">
          <strong style="color: #0f172a; text-transform: uppercase; font-size: 8px;">Cenário B: Clínica Estruturada (Gestor + 8 Terapeutas)</strong><br>
          <span style="color: #334155;">Simulação detalhada abaixo: economia expressiva em licença base, WhatsApp 100% ilimitado nativo e eliminação de repasses sobre inadimplentes.</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 36%;">Componente Operacional Avaliado</th>
            <th class="th-synapsis" style="width: 32%; text-align: center;">🧠 Synapsis Clínico (Anual)</th>
            <th class="th-psico" style="width: 32%; text-align: center;">🏢 PsicoManager (Plano Clínica)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Assinatura Base Clínica (Gestor + até 5 profissionais)</strong></td>
            <td style="text-align: center;"><strong>R$ 129,00 / mês</strong> (Lote Promocional)</td>
            <td style="text-align: center;">~R$ 129,90 a R$ 159,00 / mês</td>
          </tr>
          <tr>
            <td><strong>3 Psicólogos Extras (6º, 7º e 8º integrantes)</strong></td>
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
            <td style="text-align: center; color: #0f766e; font-size: 9.5px; font-weight: 800;">R$ 204,00 / mês</td>
            <td style="text-align: center; color: #b91c1c; font-size: 9.5px; font-weight: 800;">R$ 284,90 a R$ 374,00 / mês</td>
          </tr>
          <tr style="background: #e2e8f0; font-weight: 800;">
            <td><strong>INVESTIMENTO ANUAL EM SOFTWARE</strong></td>
            <td style="text-align: center; color: #0f766e; font-size: 10px;">R$ 2.448,00 / ano</td>
            <td style="text-align: center; color: #b91c1c; font-size: 10px;">R$ 3.418,00 a R$ 4.488,00 / ano</td>
          </tr>
          <tr>
            <td><strong>Prevenção de Prejuízos com Repasses Indevidos</strong></td>
            <td style="text-align: center; color: #0f766e; font-weight: 700;">R$ 0,00 de adiantamento em aberto</td>
            <td style="text-align: center; color: #b91c1c;">R$ 2.000 a R$ 5.000 / ano em calotes</td>
          </tr>
          <tr>
            <td><strong>Horas de Recepção Economizadas na Conciliação</strong></td>
            <td style="text-align: center; color: #0f766e; font-weight: 700;">~18 a 22 horas / mês poupadas</td>
            <td style="text-align: center;">0 horas (conferência manual de comprovantes)</td>
          </tr>
          <tr>
            <td><strong>Onboarding de Equipe & Capacitação (Academy)</strong></td>
            <td style="text-align: center; color: #0f766e; font-weight: 700;">~15 min em Sandbox sem risco</td>
            <td style="text-align: center; color: #b91c1c;">10 a 20h de dedicação do gestor (Turnover)</td>
          </tr>
        </tbody>
      </table>

      <div class="roi-banner">
        <div>
          <div class="roi-stat-title">Economia em Software</div>
          <div class="roi-stat-value">+ R$ 2.040 / ano</div>
          <div class="roi-stat-sub">Base R$ 129 e WhatsApp ilimitado</div>
        </div>
        <div style="border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px;">
          <div class="roi-stat-title">Blindagem Anti-Calote</div>
          <div class="roi-stat-value">+ R$ 3.000 / ano</div>
          <div class="roi-stat-sub">Zero comissão sobre inadimplentes</div>
        </div>
        <div style="border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px;">
          <div class="roi-stat-title">Recepção & Onboarding</div>
          <div class="roi-stat-value">+ 240 Horas / ano</div>
          <div class="roi-stat-sub">Baixa Asaas + Synapsis Academy</div>
        </div>
      </div>

      <h2>4. Política de Transição Suave: Como Migrar em 3 Passos</h2>
      <div class="steps-container">
        <div class="step-item">
          <span class="step-number">Passo 1</span>
          <div class="step-text"><strong>Exportar Backup PsicoManager:</strong> Baixe a planilha de pacientes no painel atual (Artigo 18 LGPD).</div>
        </div>
        <div class="step-item">
          <span class="step-number">Passo 2</span>
          <div class="step-text"><strong>Migrador 1-Clique Synapsis:</strong> Sobe o arquivo; nosso motor sanea CPFs e vincula responsáveis em 1 min.</div>
        </div>
        <div class="step-item">
          <span class="step-number">Passo 3</span>
          <div class="step-text"><strong>Coexistência Segura:</strong> Use os dois sistemas em paralelo até ter 100% de confiança para migrar.</div>
        </div>
      </div>

      <h2>5. Checklist de Avaliação Estratégica para o Gestor</h2>
      <div class="checklist-grid">
        <div class="check-item"><div class="check-box-icon"></div><span>Seu sistema dá baixa automática via Webhook assim que o paciente paga o PIX?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Você consegue migrar pacientes do sistema atual em 1 clique sem redigitação?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Seu sistema garante que você NUNCA repassa honorários de sessões não quitadas?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Você emite extrato timbrado em PDF com chave PIX e termo de quitação em 1 clique?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Sua clínica gerencia baterias psicométricas e emite laudos CID-11 nativamente?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Seus prontuários têm assinatura Hash SHA-256 de grau pericial (CFP 06/2019)?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Minha conta de software é previsível ou aumenta com compra de créditos WhatsApp?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Seu sistema tem simulador Sandbox (Academy) para treinar secretárias sem risco aos dados?</span></div>
      </div>

      <div class="cta-banner">
        <div class="cta-content">
          <h4>Inicie a Avaliação Prática na Sua Clínica</h4>
          <p>Experimente por <strong>14 dias sem cartão</strong> ou solicite demonstração guiada de 15 minutos.</p>
        </div>
        <div class="cta-contacts">
          WhatsApp Comercial: <strong>(11) 99999-8888</strong><br>
          E-mail: <strong>contato@synapsisclinico.com.br</strong>
        </div>
      </div>
    </div>

    <div class="footer-note">
      Synapsis Clínico — Material Oficial de Apoio Comercial. Documento confidencial destinado à diretoria clínica. Página 3 de 3.
    </div>
  </div>

</body>
</html>`;

fs.writeFileSync(outputHtml, htmlContent, 'utf-8');
console.log(`HTML da versão de 3 páginas gerado em: ${outputHtml}`);

// Caminho do Chrome / Edge
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserPath = fs.existsSync(chromePath) ? chromePath : edgePath;

const cmdV2 = `"${browserPath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${outputPdfV2}" "file:///${outputHtml.replace(/\\\\/g, '/')}"`;
const cmdMain = `"${browserPath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${outputPdfMain}" "file:///${outputHtml.replace(/\\\\/g, '/')}"`;

console.log('Executando conversão para PDF (Versão 3 Páginas com Academy)...');
execSync(cmdV2);
execSync(cmdMain);

if (fs.existsSync(outputPdfV2)) {
  const stats = fs.statSync(outputPdfV2);
  console.log(`PDF V2 gerado! Tamanho: ${stats.size} bytes em ${outputPdfV2}`);
}
if (fs.existsSync(outputPdfMain)) {
  const stats = fs.statSync(outputPdfMain);
  console.log(`PDF Principal atualizado! Tamanho: ${stats.size} bytes em ${outputPdfMain}`);
}
