import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';

const ffmpegPath = ffmpegStatic as string;

// Carrega a logo em base64 para embutir diretamente no HTML
const brainLogoPath = path.join(process.cwd(), 'public/landing/synapsi_brain1.png');
const brainBase64 = fs.existsSync(brainLogoPath)
  ? `data:image/png;base64,${fs.readFileSync(brainLogoPath).toString('base64')}`
  : '';

// Gera o template HTML cinematográfico da vinheta
function getIntroHtml(isVertical: boolean): string {
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;
  const logoSize = isVertical ? 180 : 140;
  const titleSize = isVertical ? 54 : 52;
  const subtitleSize = isVertical ? 22 : 18;
  const badgeSize = isVertical ? 14 : 12;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: ${width}px;
      height: ${height}px;
      background: #020617;
      overflow: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }

    /* Fundo com gradiente radial e partículas */
    canvas#neural-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    /* Brilho volumétrico de fundo */
    .glow-bg {
      position: absolute;
      width: ${isVertical ? '900px' : '1000px'};
      height: ${isVertical ? '900px' : '700px'};
      border-radius: 50%;
      background: radial-gradient(circle, rgba(20, 184, 166, 0.28) 0%, rgba(99, 102, 241, 0.18) 45%, transparent 75%);
      filter: blur(60px);
      z-index: 2;
      animation: pulse-glow 3.5s ease-in-out infinite;
    }

    /* Card Central com Logo e Tipografia */
    .intro-card {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: ${isVertical ? '60px 40px' : '40px 60px'};
      animation: card-appear 3.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .logo-wrapper {
      position: relative;
      margin-bottom: ${isVertical ? '32px' : '24px'};
    }

    .logo-aura {
      position: absolute;
      inset: -35px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(20, 184, 166, 0.7) 0%, rgba(13, 148, 136, 0.3) 50%, transparent 75%);
      filter: blur(25px);
      animation: aura-expand 2s ease-out infinite;
    }

    .logo-img {
      position: relative;
      height: ${logoSize}px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 0 35px rgba(20, 184, 166, 0.95)) drop-shadow(0 0 15px rgba(255, 255, 255, 0.8));
      transform: scale(0.9);
      animation: logo-zoom 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      opacity: 0;
      transform: translateY(12px);
      animation: text-reveal 0.8s 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .title-synapsis {
      font-size: ${titleSize}px;
      font-weight: 900;
      color: #ffffff;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.8), 0 0 30px rgba(255, 255, 255, 0.4);
    }

    .title-clinico {
      font-size: ${titleSize}px;
      font-weight: 300;
      color: #2dd4bf;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-shadow: 0 0 25px rgba(45, 212, 191, 0.85);
    }

    .tagline {
      font-size: ${subtitleSize}px;
      font-weight: 500;
      color: #cbd5e1;
      letter-spacing: 0.05em;
      margin-bottom: 24px;
      opacity: 0;
      transform: translateY(10px);
      animation: text-reveal 0.8s 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.7);
    }

    .badges-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      opacity: 0;
      transform: translateY(10px);
      animation: text-reveal 0.8s 0.9s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .badge {
      font-size: ${badgeSize}px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 6px 16px;
      border-radius: 9999px;
      backdrop-filter: blur(10px);
    }

    .badge-teal {
      color: #2dd4bf;
      background: rgba(20, 184, 166, 0.15);
      border: 1px solid rgba(45, 212, 191, 0.4);
      box-shadow: 0 0 15px rgba(45, 212, 191, 0.2);
    }

    .badge-blue {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.4);
      box-shadow: 0 0 15px rgba(56, 189, 248, 0.2);
    }

    .badge-purple {
      color: #c084fc;
      background: rgba(192, 132, 252, 0.15);
      border: 1px solid rgba(192, 132, 252, 0.4);
      box-shadow: 0 0 15px rgba(192, 132, 252, 0.2);
    }

    /* Linha de energia / scanline */
    .energy-bar {
      width: ${isVertical ? '280px' : '400px'};
      height: 2px;
      background: linear-gradient(90deg, transparent, #2dd4bf, #ffffff, #2dd4bf, transparent);
      margin: 16px 0;
      opacity: 0;
      animation: energy-sweep 2.5s 0.4s ease-out forwards;
      box-shadow: 0 0 12px #2dd4bf;
    }

    /* Keyframes */
    @keyframes pulse-glow {
      0%, 100% { transform: scale(0.95); opacity: 0.6; }
      50% { transform: scale(1.15); opacity: 0.9; }
    }

    @keyframes aura-expand {
      0% { transform: scale(0.85); opacity: 0.8; }
      50% { transform: scale(1.25); opacity: 0.4; }
      100% { transform: scale(0.85); opacity: 0.8; }
    }

    @keyframes logo-zoom {
      0% { transform: scale(0.75); opacity: 0; filter: brightness(2) drop-shadow(0 0 50px #2dd4bf); }
      30% { opacity: 1; transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes text-reveal {
      0% { opacity: 0; transform: translateY(14px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    @keyframes energy-sweep {
      0% { opacity: 0; transform: scaleX(0.1); }
      50% { opacity: 1; transform: scaleX(1); }
      100% { opacity: 0.7; transform: scaleX(0.85); }
    }

    @keyframes card-appear {
      0% { opacity: 0; transform: scale(0.92); }
      15% { opacity: 1; transform: scale(1); }
      85% { opacity: 1; transform: scale(1); }
      100% { opacity: 0.95; transform: scale(1.02); }
    }
  </style>
</head>
<body>
  <canvas id="neural-canvas"></canvas>
  <div class="glow-bg"></div>

  <div class="intro-card">
    <div class="logo-wrapper">
      <div class="logo-aura"></div>
      <img class="logo-img" src="${brainBase64}" alt="Synapsis Logo" />
    </div>

    <div class="title-row">
      <span class="title-synapsis">Synapsis</span>
      <span class="title-clinico">Clínico</span>
    </div>

    <div class="energy-bar"></div>

    <p class="tagline">Ciência Clínica &amp; Inteligência de Gestão</p>

    <div class="badges-row">
      <span class="badge badge-teal">CFP 06/2019</span>
      <span class="badge badge-blue">LGPD &amp; SHA-256</span>
      <span class="badge badge-purple">IA Especialista</span>
    </div>
  </div>

  <script>
    // Animação de Sinapses e Conexões Neurais no Canvas
    const canvas = document.getElementById('neural-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = ${width};
    canvas.height = ${height};

    const nodes = [];
    const nodeCount = ${isVertical ? 45 : 65};

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        radius: Math.random() * 2.5 + 1,
        color: Math.random() > 0.4 ? 'rgba(45, 212, 191, ' : 'rgba(99, 102, 241, ',
        pulse: Math.random() * Math.PI,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Conexões
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 180) {
            const alpha = (1 - dist / 180) * 0.35;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = 'rgba(45, 212, 191, ' + alpha + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      // Nós com glow
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.04;

        if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
        if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

        const currentAlpha = 0.4 + Math.sin(n.pulse) * 0.3;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = n.color + currentAlpha + ')';
        ctx.shadowColor = '#2dd4bf';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      requestAnimationFrame(draw);
    }
    draw();
  </script>
</body>
</html>`;
}

// Gera áudio cinematográfico (Whoosh Riser + Chime Cristalino)
function generateCinematicAudio(outputPath: string): string {
  console.log('🎵 Sintetizando trilha sonora de áudio branding (Whoosh + Chime)...');
  const sampleRate = 48000;
  const duration = 3.6;
  const totalSamples = Math.floor(sampleRate * duration);
  const dataSize = totalSamples * 2 * 2; // stereo, 16-bit
  const buffer = Buffer.alloc(44 + dataSize);

  // Header RIFF/WAVE
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);  // PCM
  buffer.writeUInt16LE(2, 22);  // Stereo
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    // 1. Whoosh sub-grave ascendente (40Hz -> 130Hz)
    let sub = 0;
    if (t < 1.6) {
      const f = 45 + 55 * (t / 1.6);
      const env = Math.sin((t / 1.6) * Math.PI);
      sub = Math.sin(2 * Math.PI * f * t) * env * 0.45;
    }

    // 2. Chime cristalino luminoso a partir de t = 0.5s
    let chime = 0;
    if (t >= 0.5) {
      const dt = t - 0.5;
      const decay = Math.exp(-dt * 1.5);
      // Harmônicos brilhantes: E4 (329Hz), B4 (493Hz), E5 (659Hz), B5 (987Hz), E6 (1318Hz)
      chime = (
        0.28 * Math.sin(2 * Math.PI * 329.63 * dt) +
        0.25 * Math.sin(2 * Math.PI * 493.88 * dt) +
        0.22 * Math.sin(2 * Math.PI * 659.25 * dt) +
        0.18 * Math.sin(2 * Math.PI * 987.77 * dt) +
        0.14 * Math.sin(2 * Math.PI * 1318.5 * dt)
      ) * decay;
    }

    // 3. Imagem estéreo com leve shimmer
    let leftSample = sub + chime * (1 + 0.12 * Math.sin(2 * Math.PI * 3.5 * t));
    let rightSample = sub + chime * (1 - 0.12 * Math.sin(2 * Math.PI * 3.5 * t));

    // Master fade out no final
    let masterEnv = 1.0;
    if (t > 2.8) {
      masterEnv = Math.max(0, 1 - (t - 2.8) / 0.8);
    }
    leftSample *= masterEnv;
    rightSample *= masterEnv;

    const clamp = (val: number) => Math.max(-1, Math.min(1, val));
    const intL = Math.floor(clamp(leftSample) * 32767);
    const intR = Math.floor(clamp(rightSample) * 32767);

    buffer.writeInt16LE(intL, offset);
    buffer.writeInt16LE(intR, offset + 2);
    offset += 4;
  }

  const rawWavPath = path.join(path.dirname(outputPath), 'temp_audio.wav');
  fs.writeFileSync(rawWavPath, buffer);

  // Aplica reverb e converte para AAC
  const cmd = `"${ffmpegPath}" -y -i "${rawWavPath}" -af "aecho=0.8:0.7:60:0.35" -c:a aac -b:a 192k "${outputPath}"`;
  execSync(cmd, { stdio: 'pipe' });
  try { fs.unlinkSync(rawWavPath); } catch {}

  console.log(`✅ Áudio cinematográfico gerado: ${outputPath}`);
  return outputPath;
}

async function renderIntroVideo(isVertical: boolean, audioPath: string, finalOutputPath: string) {
  const formatName = isVertical ? '9:16 Vertical (Shorts)' : '16:9 Widescreen (Horizontal)';
  console.log(`🎬 Gravando vinheta ${formatName}...`);

  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;

  // Cria arquivo HTML temporário
  const htmlContent = getIntroHtml(isVertical);
  const tempHtmlPath = path.join(process.cwd(), `public/videos/assets/temp_intro_${isVertical ? '9x16' : '16x9'}.html`);
  fs.writeFileSync(tempHtmlPath, htmlContent);

  const browser = await chromium.launch({ headless: true });
  const tempRecordDir = path.join(process.cwd(), `public/videos/assets/temp_record_${isVertical ? '9x16' : '16x9'}`);
  fs.mkdirSync(tempRecordDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: {
      dir: tempRecordDir,
      size: { width, height },
    },
  });

  const page = await context.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });

  // Grava por 3.6 segundos
  await page.waitForTimeout(3600);

  const videoObject = page.video();
  await page.close();
  await context.close();
  await browser.close();

  let rawVideoPath = '';
  if (videoObject) {
    rawVideoPath = await videoObject.path();
  } else {
    const files = fs.readdirSync(tempRecordDir).filter(f => f.endsWith('.webm'));
    if (files.length > 0) rawVideoPath = path.join(tempRecordDir, files[0]);
  }

  console.log(`  -> Codificando H.264 Full HD com áudio integrado via FFmpeg...`);
  const cmd = `"${ffmpegPath}" -y -i "${rawVideoPath}" -i "${audioPath}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy -shortest "${finalOutputPath}"`;
  execSync(cmd, { stdio: 'pipe' });

  // Limpeza
  try {
    fs.unlinkSync(tempHtmlPath);
    if (rawVideoPath && fs.existsSync(rawVideoPath)) fs.unlinkSync(rawVideoPath);
    fs.rmSync(tempRecordDir, { recursive: true, force: true });
  } catch {}

  console.log(`✅ Vinheta ${formatName} gerada com sucesso em: ${finalOutputPath}`);
}

async function main() {
  console.log('🚀 Iniciando renderização da Abertura PREMIUM Synapsis Clínico...');
  const assetsDir = path.join(process.cwd(), 'public/videos/assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const audioPath = path.join(assetsDir, 'synapsis_intro_audio.aac');
  generateCinematicAudio(audioPath);

  // 1. Renderiza 16:9 (Horizontal / YouTube padrão / Central de Ajuda)
  const output16x9 = path.join(assetsDir, 'synapsis_intro_16x9.mp4');
  await renderIntroVideo(false, audioPath, output16x9);

  // 2. Renderiza 9:16 (Vertical / YouTube Shorts / Reels / TikTok)
  const output9x16 = path.join(assetsDir, 'synapsis_intro_9x16.mp4');
  await renderIntroVideo(true, audioPath, output9x16);

  console.log('\n🎉 Ambas as vinhetas PREMIUM foram concluídas com perfeição!');
  console.log('   -> 16:9 Widescreen: public/videos/assets/synapsis_intro_16x9.mp4');
  console.log('   -> 9:16 Vertical:   public/videos/assets/synapsis_intro_9x16.mp4');
}

main().catch(console.error);
