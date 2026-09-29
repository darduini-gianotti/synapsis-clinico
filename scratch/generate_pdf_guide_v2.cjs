const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const logoPath = path.join(rootDir, 'landing', 'synapsi_brain1.png');
const outputHtml = path.join(rootDir, 'scratch', 'guia_impressao.html');
const outputPdf = path.join(rootDir, 'docs', 'GUIA_DECISAO_COMERCIAL_SYNAPSIS_VS_PSICOMANAGER_2PAGINAS.pdf');

// Ler o logo e converter para Base64
let logoBase64 = '';
if (fs.existsSync(logoPath)) {
  const logoBuffer = fs.readFileSync(logoPath);
  logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
}

// Layout ultra calibrado para 2 PÁGINAS A4
const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Synapsis Clínico vs. PsicoManager — Guia Executivo de Decisão</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    @page {
      size: A4 portrait;
      margin: 8mm 10mm 8mm 10mm;
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
      font-size: 9.5px;
      line-height: 1.35;
    }

    .page-container {
      width: 100%;
      height: 280mm;
      max-height: 280mm;
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
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .brand-box {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      object-fit: contain;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0f172a;
      line-height: 1.1;
    }
    .brand-title span {
      color: #0d9488;
    }
    .brand-tagline {
      font-size: 8px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
    }
    .badge-doc {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      color: #0f766e;
      font-size: 8px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: right;
      line-height: 1.25;
    }

    /* Títulos */
    h1 {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      margin-bottom: 2px;
      letter-spacing: -0.3px;
    }
    .subtitle {
      font-size: 9px;
      color: #475569;
      font-weight: 600;
      margin-bottom: 6px;
    }
    h2 {
      font-size: 11px;
      font-weight: 800;
      color: #0f172a;
      border-left: 3px solid #0d9488;
      padding-left: 6px;
      margin: 6px 0 5px 0;
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
      border-radius: 6px;
      padding: 6px 9px;
      margin-bottom: 6px;
      font-size: 8.8px;
      color: #334155;
      line-height: 1.35;
    }
    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 5px;
      margin-bottom: 6px;
    }
    .pillar-card {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      padding: 5px 6px;
      border-top: 2.5px solid #0d9488;
    }
    .pillar-card-title {
      font-size: 8px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pillar-card-desc {
      font-size: 7.2px;
      color: #64748b;
      line-height: 1.25;
    }

    /* Tabelas Executivas */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.2px;
      margin-bottom: 4px;
    }
    th {
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-align: left;
      padding: 4px 6px;
      font-size: 8px;
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
      padding: 3.5px 6px;
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
      padding: 1.5px 4px;
      border-radius: 3px;
      font-size: 7.8px;
      display: inline-block;
    }
    .badge-warn {
      background: #fef3c7;
      color: #b45309;
      font-weight: 600;
      padding: 1.5px 4px;
      border-radius: 3px;
      font-size: 7.8px;
      display: inline-block;
    }
    .badge-cross {
      background: #fee2e2;
      color: #b91c1c;
      font-weight: 600;
      padding: 1.5px 4px;
      border-radius: 3px;
      font-size: 7.8px;
      display: inline-block;
    }

    /* PÁGINA 2: GRID DOS 5 PILARES */
    .pillars-detailed-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-bottom: 6px;
    }
    .pillar-box {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 5px 7px;
    }
    .pillar-box.full-width {
      grid-column: span 2;
    }
    .pillar-header {
      font-size: 9px;
      font-weight: 800;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 3px;
    }
    .mini-compare {
      display: grid;
      grid-template-columns: 1fr 1.35fr;
      gap: 5px;
      font-size: 7.8px;
      line-height: 1.25;
    }
    .box-dor {
      background: #fff1f2;
      border-left: 2px solid #e11d48;
      padding: 3px 5px;
      border-radius: 3px;
      color: #881337;
    }
    .box-synapsis {
      background: #f0fdfa;
      border-left: 2px solid #0d9488;
      padding: 3px 5px;
      border-radius: 3px;
      color: #134e4a;
    }

    /* Bloco de ROI */
    .roi-banner {
      background: linear-gradient(135deg, #042f2e 0%, #0f172a 100%);
      color: #ffffff;
      border-radius: 6px;
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
      letter-spacing: 0.4px;
    }
    .roi-stat-value {
      font-size: 13.5px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.15;
    }
    .roi-stat-sub {
      font-size: 7px;
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
      padding: 5px 7px;
      position: relative;
    }
    .step-badge {
      display: inline-block;
      background: #0d9488;
      color: #ffffff;
      font-size: 7px;
      font-weight: 800;
      padding: 1px 5px;
      border-radius: 9999px;
      margin-bottom: 2px;
    }
    .step-text {
      font-size: 7.8px;
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
      align-items: center;
      gap: 5px;
      line-height: 1.2;
    }
    .check-box-icon {
      width: 10px;
      height: 10px;
      border: 1.5px solid #0d9488;
      border-radius: 2px;
      flex-shrink: 0;
    }

    /* Call to Action Final */
    .cta-banner {
      background: #f0fdfa;
      border: 1.5px solid #0d9488;
      border-radius: 6px;
      padding: 6px 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .cta-content h4 {
      font-size: 9.5px;
      font-weight: 800;
      color: #0f766e;
    }
    .cta-content p {
      font-size: 8px;
      color: #334155;
    }
    .cta-contacts {
      text-align: right;
      font-size: 8px;
      color: #0f172a;
      font-weight: 600;
    }
    .cta-contacts strong {
      color: #0d9488;
    }

    /* Rodapé */
    .footer-note {
      font-size: 7.2px;
      color: #94a3b8;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
      margin-top: 4px;
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
      <div class="subtitle">Análise Comparativa de Arquitetura, Blindagem Financeira, Avaliação Neuropsicológica e Custo Total de Propriedade (TCO)</div>

      <div class="summary-box">
        <strong>Sumário Executivo:</strong> A escolha do software central de uma clínica multiprofissional transcende agendas e cadastros: impacta a <strong>blindagem do fluxo de caixa contra inadimplência</strong>, a <strong>paz contábil no repasse de honorários</strong>, o <strong>cumprimento da Resolução CFP 06/2019</strong> e a <strong>produtividade da recepção</strong>. Enquanto sistemas legados mantêm dependência de conferências bancárias manuais e cobrança de créditos de WhatsApp, o <strong>Synapsis Clínico</strong> oferece infraestrutura de grau pericial com baixa automática via Asaas Webhook, migrador nativo do PsicoManager em 1 clique e módulo completo de neuropsicologia.
      </div>

      <div class="pillars-grid">
        <div class="pillar-card">
          <div class="pillar-card-title">⚡ Asaas Webhook</div>
          <div class="pillar-card-desc">Baixa bancária em tempo real sem pedir comprovante de PIX.</div>
        </div>
        <div class="pillar-card">
          <div class="pillar-card-title">🚀 Migrador 1-Clique</div>
          <div class="pillar-card-desc">Importa CSV do PsicoManager com saneamento algorítmico.</div>
        </div>
        <div class="pillar-card">
          <div class="pillar-card-title">🛡️ Repasse Blindado</div>
          <div class="pillar-card-desc">Comissão calculada apenas sobre consultas efetivamente pagas.</div>
        </div>
        <div class="pillar-card">
          <div class="pillar-card-title">🧠 Neuro Nativa</div>
          <div class="pillar-card-desc">Baterias psicométricas, percentis normativos e laudos CID-11.</div>
        </div>
        <div class="pillar-card">
          <div class="pillar-card-title">🔒 Grau Pericial</div>
          <div class="pillar-card-desc">Hash imutável SHA-256 e criptografia AES-256-GCM.</div>
        </div>
        <div class="pillar-card">
          <div class="pillar-card-title">💎 Zero Custos Extras</div>
          <div class="pillar-card-desc">WhatsApp ilimitado nativo e secretárias gratuitas.</div>
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
      Synapsis Clínico © 2026 — Inteligência Operacional & Prontuário Pericial para Psicologia. Documento Confidencial. Página 1 de 2.
    </div>
  </div>

  <!-- ==================== PÁGINA 2: OS 5 PILARES, ROI, TRANSIÇÃO & CHECKLIST ==================== -->
  <div class="page-container">
    <div>
      <div class="header-banner" style="margin-bottom: 5px; padding-bottom: 4px;">
        <div class="brand-box">
          ${logoBase64 ? `<img src="${logoBase64}" class="brand-logo" style="width: 28px; height: 28px;" alt="Synapsis Logo">` : ''}
          <div>
            <div class="brand-title" style="font-size: 14px;">SYNAPSIS <span>CLÍNICO</span></div>
            <div class="brand-tagline" style="font-size: 7.2px;">Dossiê Comparativo, Simulação de ROI & Transição Suave</div>
          </div>
        </div>
        <div class="badge-doc" style="font-size: 7.2px; padding: 2px 7px;">
          Página 2 de 2
        </div>
      </div>

      <h2>2. Aprofundamento dos 5 Pilares de Diferenciação Técnica</h2>
      <div class="pillars-detailed-grid">
        
        <!-- Pilar 1 -->
        <div class="pillar-box">
          <div class="pillar-header">⚡ Pilar 1: Cobrança Asaas & Baixa via Webhook</div>
          <div class="mini-compare">
            <div class="box-dor">
              <strong>PsicoManager:</strong> Recepção exige comprovantes de PIX por WhatsApp e gasta 1h/dia conferindo extrato antes de dar baixa.
            </div>
            <div class="box-synapsis">
              <strong>Synapsis:</strong> QR Code PIX dinâmico em 1 clique. O paciente paga no app do banco e a sessão vira <strong>PAGO</strong> em segundos na recepção sem ação humana.
            </div>
          </div>
        </div>

        <!-- Pilar 2 -->
        <div class="pillar-box">
          <div class="pillar-header">🚀 Pilar 2: Migrador PsicoManager em 1 Clique</div>
          <div class="mini-compare">
            <div class="box-dor">
              <strong>Objeção:</strong> <em>"Tenho centenas de pacientes no PsicoManager e receio o retrabalho de redigitação manual."</em>
            </div>
            <div class="box-synapsis">
              <strong>Synapsis:</strong> Importador dedicado que lê o CSV oficial do PsicoManager, sanea CPFs na Receita e vincula responsáveis e menores em 1 minuto.
            </div>
          </div>
        </div>

        <!-- Pilar 3 -->
        <div class="pillar-box">
          <div class="pillar-header">🛡️ Pilar 3: Repasse Blindado Anti-Calote</div>
          <div class="mini-compare">
            <div class="box-dor">
              <strong>PsicoManager:</strong> Relatório simples sem trava contra calotes. A clínica corre o risco diário de adiantar honorários de inadimplentes.
            </div>
            <div class="box-synapsis">
              <strong>Synapsis:</strong> Comissões calculadas estritamente sobre sessões pagas. Emissão de extrato formal timbrado em PDF com chave PIX e quitação recíproca.
            </div>
          </div>
        </div>

        <!-- Pilar 4 -->
        <div class="pillar-box">
          <div class="pillar-header">🧠 Pilar 4: Neuropsicologia Nativa no Brasil</div>
          <div class="mini-compare">
            <div class="box-dor">
              <strong>PsicoManager:</strong> Inexistência de suporte neuro. Avaliações complexas são geridas em pastas manuais e Word avulso.
            </div>
            <div class="box-synapsis">
              <strong>Synapsis:</strong> Gestão de pacotes neuro (anamnese, testagem, devolutiva), baterias psicométricas com percentis e laudos CID-11 / DSM-5.
            </div>
          </div>
        </div>

        <!-- Pilar 5 -->
        <div class="pillar-box full-width">
          <div class="pillar-header">🔒 Pilar 5: Prontuário Pericial SHA-256 e Política Comercial Transparente</div>
          <div class="mini-compare" style="grid-template-columns: 1fr 2fr;">
            <div class="box-dor">
              <strong>PsicoManager:</strong> Prontuário simples com logs comuns de banco e cobrança recorrente por pacotes extras de WhatsApp.
            </div>
            <div class="box-synapsis">
              <strong>Synapsis:</strong> Hash SHA-256 (CFP 06/2019), WhatsApp ilimitado nativo e planos: <strong>Solo (R$ 69)</strong>, <strong>Parceria PJ (R$ 99 c/ NFS-e)</strong> e <strong>Clínica (R$ 129 + R$ 25/adicional)</strong>.
            </div>
          </div>
        </div>

      </div>

      <h2>3. Simulação de ROI em 12 Meses (Clínica com 8 Profissionais Parceiros)</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 38%;">Componente Operacional</th>
            <th class="th-synapsis" style="width: 32%; text-align: center;">🧠 Synapsis Clínico (Anual)</th>
            <th class="th-psico" style="width: 30%; text-align: center;">🏢 PsicoManager (Plano Clínica)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Assinatura Base (até 5 profissionais)</strong></td>
            <td style="text-align: center;"><strong>R$ 129,00 / mês</strong> (Lote Promocional)</td>
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
            <td style="text-align: center;">Manual (Consome 1h/dia da recepção)</td>
          </tr>
          <tr style="background: #f1f5f9; font-weight: 700;">
            <td><strong>CUSTO MENSAL TOTAL ESTIMADO</strong></td>
            <td style="text-align: center; color: #0f766e; font-weight: 800;">R$ 204,00 / mês</td>
            <td style="text-align: center; color: #b91c1c; font-weight: 800;">R$ 284,90 a R$ 374,00 / mês</td>
          </tr>
          <tr style="background: #e2e8f0; font-weight: 800;">
            <td><strong>INVESTIMENTO ANUAL EM SOFTWARE</strong></td>
            <td style="text-align: center; color: #0f766e; font-size: 9px;">R$ 2.448,00 / ano</td>
            <td style="text-align: center; color: #b91c1c; font-size: 9px;">R$ 3.418,00 a R$ 4.488,00 / ano</td>
          </tr>
        </tbody>
      </table>

      <div class="roi-banner">
        <div>
          <div class="roi-stat-title">Economia em Licença</div>
          <div class="roi-stat-value">+ R$ 2.040 / ano</div>
          <div class="roi-stat-sub">Preço base R$ 129 e sem recargas de WhatsApp</div>
        </div>
        <div style="border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px;">
          <div class="roi-stat-title">Blindagem Anti-Calote</div>
          <div class="roi-stat-value">+ R$ 3.000 / ano</div>
          <div class="roi-stat-sub">Zero comissões sobre consultas não pagas</div>
        </div>
        <div style="border-left: 1px solid rgba(255,255,255,0.2); padding-left: 10px;">
          <div class="roi-stat-title">Produtividade Recepção</div>
          <div class="roi-stat-value">+ 200 Horas / ano</div>
          <div class="roi-stat-sub">Baixa automática Asaas e extrato em 1 clique</div>
        </div>
      </div>

      <h2>4. Transição Suave em 3 Passos & Checklist de Decisão</h2>
      <div class="steps-container">
        <div class="step-item">
          <span class="step-badge">Passo 1</span>
          <div class="step-text"><strong>Exportação no PsicoManager:</strong> A clínica baixa a planilha de pacientes (Art. 18 LGPD).</div>
        </div>
        <div class="step-item">
          <span class="step-badge">Passo 2</span>
          <div class="step-text"><strong>Migrador 1-Clique Synapsis:</strong> Sobe o CSV; CPFs e responsáveis são saneados em 1 minuto.</div>
        </div>
        <div class="step-item">
          <span class="step-badge">Passo 3</span>
          <div class="step-text"><strong>Coexistência Segura:</strong> Atenda no Synapsis em paralelo até ter 100% de confiança para migrar.</div>
        </div>
      </div>

      <div class="checklist-grid">
        <div class="check-item"><div class="check-box-icon"></div><span>Seu sistema dá baixa automática via Webhook sem pedir comprovante de PIX?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Você consegue migrar pacientes em 1 clique com importador dedicado?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Seu sistema garante que você NUNCA repassa sobre sessões não pagas?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Você emite extrato timbrado em PDF com chave PIX e quitação em 1 clique?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Sua clínica gerencia baterias psicométricas e laudos CID-11 nativamente?</span></div>
        <div class="check-item"><div class="check-box-icon"></div><span>Seus prontuários têm assinatura Hash SHA-256 de grau pericial (CFP 06/2019)?</span></div>
      </div>

      <div class="cta-banner">
        <div class="cta-content">
          <h4>Avalie na Prática na Sua Clínica</h4>
          <p>Experimente por <strong>14 dias sem cartão</strong> ou solicite demonstração de 15 minutos com um especialista.</p>
        </div>
        <div class="cta-contacts">
          WhatsApp Comercial: <strong>(11) 99999-8888</strong><br>
          E-mail: <strong>contato@synapsisclinico.com.br</strong>
        </div>
      </div>
    </div>

    <div class="footer-note">
      Synapsis Clínico — Material Oficial de Apoio Comercial. Documento confidencial destinado à diretoria clínica. Página 2 de 2.
    </div>
  </div>

</body>
</html>`;

fs.writeFileSync(outputHtml, htmlContent, 'utf-8');
console.log(`HTML gerado em: ${outputHtml}`);

// Caminho do Chrome / Edge
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const browserPath = fs.existsSync(chromePath) ? chromePath : edgePath;

const cmd = `"${browserPath}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${outputPdf}" "file:///${outputHtml.replace(/\\\\/g, '/')}"`;

console.log('Executando conversão para PDF...');
execSync(cmd);

if (fs.existsSync(outputPdf)) {
  const stats = fs.statSync(outputPdf);
  console.log(`PDF gerado! Tamanho: ${stats.size} bytes em ${outputPdf}`);
} else {
  console.error('Erro: PDF não gerado.');
  process.exit(1);
}
