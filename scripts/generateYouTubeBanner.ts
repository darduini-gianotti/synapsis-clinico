import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const brainLogoPath = path.join(process.cwd(), 'public/landing/synapsi_brain1.png');
const brainBase64 = fs.existsSync(brainLogoPath)
  ? `data:image/png;base64,${fs.readFileSync(brainLogoPath).toString('base64')}`
  : '';

function getBannerHtml(): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 2560px;
      height: 1440px;
      background: #020617;
      overflow: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    /* Fundo com nós neurais e feixes de energia */
    canvas#banner-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    /* Brilho volumétrico central */
    .glow-center {
      position: absolute;
      width: 1400px;
      height: 700px;
      border-radius: 50%;
      background: radial-gradient(ellipse at center, rgba(20, 184, 166, 0.38) 0%, rgba(168, 85, 247, 0.22) 40%, transparent 75%);
      filter: blur(80px);
      z-index: 2;
    }

    /* Safe Area Container (1546 x 423 px) perfeitamente centralizado */
    .safe-area {
      position: relative;
      z-index: 10;
      width: 1546px;
      height: 423px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 40px;
    }

    /* Lado Esquerdo: Identidade Visual e Título */
    .brand-group {
      display: flex;
      align-items: center;
      gap: 36px;
    }

    .logo-wrapper {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-aura {
      position: absolute;
      inset: -30px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(45, 212, 191, 0.95) 0%, rgba(192, 132, 252, 0.45) 50%, transparent 75%);
      filter: blur(35px);
    }

    .logo-img {
      position: relative;
      height: 220px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 0 45px rgba(20, 184, 166, 0.95)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.8));
    }

    .brand-texts {
      display: flex;
      flex-direction: column;
    }

    .title-row {
      display: flex;
      align-items: baseline;
      gap: 16px;
    }

    .title-synapsis {
      font-size: 76px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-shadow: 0 6px 30px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 255, 255, 0.4);
    }

    .title-clinico {
      font-size: 76px;
      font-weight: 300;
      color: #2dd4bf;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-shadow: 0 0 30px rgba(45, 212, 191, 0.9);
    }

    .tagline {
      font-size: 26px;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: 0.04em;
      margin-top: 6px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
    }

    .badges-row {
      display: flex;
      gap: 14px;
      margin-top: 24px;
    }

    .badge {
      font-size: 15px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 8px 20px;
      border-radius: 9999px;
      backdrop-filter: blur(12px);
    }

    .badge-teal {
      color: #2dd4bf;
      background: rgba(20, 184, 166, 0.18);
      border: 1.5px solid rgba(45, 212, 191, 0.55);
      box-shadow: 0 0 20px rgba(45, 212, 191, 0.25);
    }

    .badge-blue {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.18);
      border: 1.5px solid rgba(56, 189, 248, 0.55);
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);
    }

    .badge-purple {
      color: #c084fc;
      background: rgba(192, 132, 252, 0.18);
      border: 1.5px solid rgba(192, 132, 252, 0.55);
      box-shadow: 0 0 20px rgba(192, 132, 252, 0.25);
    }

    /* Lado Direito: Pilares do Sistema & URL Oficial */
    .info-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      text-align: right;
    }

    .features-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
      font-weight: 600;
      color: #e2e8f0;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
    }

    .feature-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #2dd4bf;
      box-shadow: 0 0 10px #2dd4bf;
    }

    .domain-pill {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 12px 28px;
      border-radius: 16px;
      background: rgba(15, 23, 42, 0.8);
      border: 1.5px solid rgba(45, 212, 191, 0.5);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 25px rgba(45, 212, 191, 0.2);
    }

    .domain-text {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: 0.05em;
    }

    .domain-accent {
      color: #2dd4bf;
    }
  </style>
</head>
<body>
  <canvas id="banner-canvas"></canvas>
  <div class="glow-center"></div>

  <div class="safe-area">
    <div class="brand-group">
      <div class="logo-wrapper">
        <div class="logo-aura"></div>
        <img class="logo-img" src="${brainBase64}" alt="Synapsis Logo" />
      </div>
      <div class="brand-texts">
        <div class="title-row">
          <span class="title-synapsis">Synapsis</span>
          <span class="title-clinico">Clínico</span>
        </div>
        <p class="tagline">Ciência Clínica &amp; Inteligência de Gestão</p>
        <div class="badges-row">
          <span class="badge badge-teal">CFP 06/2019</span>
          <span class="badge badge-blue">LGPD &amp; SHA-256</span>
          <span class="badge badge-purple">IA Especialista</span>
        </div>
      </div>
    </div>

    <div class="info-right">
      <div class="features-list">
        <div class="feature-item">
          <span>Prontuário Imutável Criptografado</span>
          <div class="feature-dot"></div>
        </div>
        <div class="feature-item">
          <span>Avaliações Neuropsicológicas &amp; Testes</span>
          <div class="feature-dot"></div>
        </div>
        <div class="feature-item">
          <span>Gestão Financeira, Carnê-Leão &amp; DARF</span>
          <div class="feature-dot"></div>
        </div>
      </div>
      <div class="domain-pill">
        <span class="domain-text">synapsisclinico<span class="domain-accent">.com.br</span></span>
      </div>
    </div>
  </div>

  <script>
    const canvas = document.getElementById('banner-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 2560;
    canvas.height = 1440;

    // Feixes de dados cibernéticos (estilo Quantum Cyber)
    const beams = [];
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const len = Math.random() * 180 + 60;
      const alpha = Math.random() * 0.4 + 0.1;
      const grad = ctx.createLinearGradient(x, y, x, y + len);
      grad.addColorStop(0, 'rgba(45, 212, 191, ' + alpha + ')');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, 2, len);
    }

    // Rede neural periférica
    const nodes = [];
    for (let i = 0; i < 90; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2.5 + 1.2,
        alpha: Math.random() * 0.5 + 0.2
      });
    }

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 180) {
          ctx.strokeStyle = 'rgba(45, 212, 191, ' + ((1 - dist / 180) * 0.25) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }

    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 211, 238, ' + n.alpha + ')';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.fill();
    }
  </script>
</body>
</html>`;
}

async function main() {
  console.log('🎨 Renderizando Banner Oficial do YouTube (2560x1440)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 2560, height: 1440 }
  });

  const html = getBannerHtml();
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const outputPath = path.join(process.cwd(), 'public/landing/youtube_banner_2560x1440.png');
  await page.screenshot({ path: outputPath, type: 'png' });
  await browser.close();

  console.log(`✅ Banner gerado com sucesso em: ${outputPath}`);
}

main().catch(console.error);
