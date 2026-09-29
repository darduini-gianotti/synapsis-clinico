import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';

const ffmpegPath = ffmpegStatic as string;

// Carrega a logo em base64
const brainLogoPath = path.join(process.cwd(), 'public/landing/synapsi_brain1.png');
const brainBase64 = fs.existsSync(brainLogoPath)
  ? `data:image/png;base64,${fs.readFileSync(brainLogoPath).toString('base64')}`
  : '';

export type VariantType = 'hero_subdrop' | 'zen_crystal' | 'quantum_cyber';

interface VariantConfig {
  id: VariantType;
  title: string;
  logoSize16x9: number;
  logoSize9x16: number;
  bgGlowColor: string;
  auraStyle: string;
  cardAnimation: string;
  extraStyles: string;
  canvasScript: (width: number, height: number, isVertical: boolean) => string;
}

const VARIANTS: Record<VariantType, VariantConfig> = {
  // OPÇÃO 2: HERO NEURAL SUB-DROP (Logo Extra Grande, Imersivo)
  hero_subdrop: {
    id: 'hero_subdrop',
    title: 'Hero Neural Sub-Drop (Logo Extra Grande)',
    logoSize16x9: 250,
    logoSize9x16: 320,
    bgGlowColor: 'radial-gradient(circle, rgba(20, 184, 166, 0.42) 0%, rgba(6, 182, 212, 0.25) 45%, transparent 75%)',
    auraStyle: `
      inset: -45px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(45, 212, 191, 0.9) 0%, rgba(6, 182, 212, 0.4) 45%, transparent 70%);
      filter: blur(35px);
      animation: aura-expand-hero 2s ease-out infinite;
    `,
    cardAnimation: 'card-hero 3.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
    extraStyles: `
      @keyframes aura-expand-hero {
        0% { transform: scale(0.85); opacity: 0.9; }
        50% { transform: scale(1.35); opacity: 0.5; }
        100% { transform: scale(0.85); opacity: 0.9; }
      }
      @keyframes card-hero {
        0% { opacity: 0; transform: scale(0.85); }
        20% { opacity: 1; transform: scale(1.03); }
        85% { opacity: 1; transform: scale(1); }
        100% { opacity: 0.96; transform: scale(1.02); }
      }
    `,
    canvasScript: (w, h, isVertical) => `
      const canvas = document.getElementById('neural-canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = ${w};
      canvas.height = ${h};

      const nodes = [];
      const count = ${isVertical ? 50 : 75};
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 100 + Math.random() * (canvas.width * 0.48);
        nodes.push({
          x: centerX + Math.cos(angle) * dist,
          y: centerY + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          radius: Math.random() * 2.8 + 1.2,
          pulse: Math.random() * Math.PI,
          targetCenterX: centerX,
          targetCenterY: centerY
        });
      }

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Conexões
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const dist = Math.hypot(dx, dy);
            if (dist < 150) {
              const alpha = (1 - dist / 150) * 0.35;
              ctx.strokeStyle = 'rgba(45, 212, 191, ' + alpha + ')';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(nodes[i].x, nodes[i].y);
              ctx.lineTo(nodes[j].x, nodes[j].y);
              ctx.stroke();
            }
          }
        }

        // Nós com bioluminescência
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          n.pulse += 0.04;
          if (n.x < 0 || n.x > canvas.width) n.vx *= -1;
          if (n.y < 0 || n.y > canvas.height) n.vy *= -1;

          const alpha = 0.5 + Math.sin(n.pulse) * 0.4;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(34, 211, 238, ' + alpha + ')';
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        requestAnimationFrame(draw);
      }
      draw();
    `
  },

  // OPÇÃO 3: ZEN CRISTAL (Logo Grande, Humanista, Harmônica)
  zen_crystal: {
    id: 'zen_crystal',
    title: 'Zen Crystal (Logo Grande, Humanista & Mindfulness)',
    logoSize16x9: 220,
    logoSize9x16: 280,
    bgGlowColor: 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, rgba(99, 102, 241, 0.22) 50%, transparent 80%)',
    auraStyle: `
      inset: -50px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(52, 211, 153, 0.75) 0%, rgba(129, 140, 248, 0.35) 55%, transparent 75%);
      filter: blur(40px);
      animation: aura-expand-zen 3.2s ease-in-out infinite;
    `,
    cardAnimation: 'card-zen 3.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
    extraStyles: `
      @keyframes aura-expand-zen {
        0%, 100% { transform: scale(0.9); opacity: 0.7; }
        50% { transform: scale(1.2); opacity: 1; }
      }
      @keyframes card-zen {
        0% { opacity: 0; transform: translateY(15px) scale(0.95); }
        25% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 1; transform: scale(1); }
      }
    `,
    canvasScript: (w, h, isVertical) => `
      const canvas = document.getElementById('neural-canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = ${w};
      canvas.height = ${h};

      let time = 0;
      const rings = [0, 60, 120, 180, 240];
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        time += 0.02;

        // Ondas concêntricas de luz/respiração
        for (let i = 0; i < rings.length; i++) {
          rings[i] += 0.8;
          if (rings[i] > 360) rings[i] = 0;
          const progress = rings[i] / 360;
          const alpha = Math.sin(progress * Math.PI) * 0.22;
          
          ctx.beginPath();
          ctx.arc(centerX, centerY, rings[i], 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(52, 211, 153, ' + alpha + ')';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        requestAnimationFrame(draw);
      }
      draw();
    `
  },

  // OPÇÃO 4: QUANTUM CYBER (Logo Ultra Gigante, Vanguardista)
  quantum_cyber: {
    id: 'quantum_cyber',
    title: 'Quantum Cyber (Logo Ultra Gigante & Vanguardista)',
    logoSize16x9: 280,
    logoSize9x16: 360,
    bgGlowColor: 'radial-gradient(circle, rgba(45, 212, 191, 0.45) 0%, rgba(168, 85, 247, 0.28) 45%, transparent 75%)',
    auraStyle: `
      inset: -55px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(45, 212, 191, 0.95) 0%, rgba(192, 132, 252, 0.5) 45%, transparent 75%);
      filter: blur(45px);
      animation: aura-expand-cyber 1.8s ease-in-out infinite alternate;
    `,
    cardAnimation: 'card-cyber 3.6s cubic-bezier(0.12, 0.9, 0.2, 1) forwards',
    extraStyles: `
      @keyframes aura-expand-cyber {
        0% { transform: scale(0.8); opacity: 0.7; filter: blur(30px); }
        100% { transform: scale(1.3); opacity: 1; filter: blur(50px); }
      }
      @keyframes card-cyber {
        0% { opacity: 0; transform: scale(0.75); filter: brightness(2); }
        15% { opacity: 1; transform: scale(1.05); filter: brightness(1.2); }
        30% { transform: scale(1); filter: brightness(1); }
        100% { opacity: 1; transform: scale(1.02); }
      }
    `,
    canvasScript: (w, h, isVertical) => `
      const canvas = document.getElementById('neural-canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = ${w};
      canvas.height = ${h};

      const beams = [];
      for (let i = 0; i < 40; i++) {
        beams.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          length: Math.random() * 80 + 30,
          speed: Math.random() * 2 + 1,
          alpha: Math.random() * 0.4 + 0.1
        });
      }

      function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const b of beams) {
          b.y -= b.speed;
          if (b.y < -100) b.y = canvas.height + 50;

          const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.length);
          grad.addColorStop(0, 'rgba(45, 212, 191, ' + b.alpha + ')');
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.fillRect(b.x, b.y, 1.5, b.length);
        }
        requestAnimationFrame(draw);
      }
      draw();
    `
  }
};

// Gera o template HTML
function getVariantHtml(variantKey: VariantType, isVertical: boolean): string {
  const v = VARIANTS[variantKey];
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;
  const logoSize = isVertical ? v.logoSize9x16 : v.logoSize16x9;
  const titleSize = isVertical ? 56 : 54;
  const subtitleSize = isVertical ? 24 : 20;
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

    canvas#neural-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
    }

    .glow-bg {
      position: absolute;
      width: ${isVertical ? '950px' : '1100px'};
      height: ${isVertical ? '950px' : '800px'};
      border-radius: 50%;
      background: ${v.bgGlowColor};
      filter: blur(70px);
      z-index: 2;
    }

    .intro-card {
      position: relative;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: ${isVertical ? '50px 30px' : '30px 50px'};
      animation: ${v.cardAnimation};
    }

    .logo-wrapper {
      position: relative;
      margin-bottom: ${isVertical ? '28px' : '20px'};
    }

    .logo-aura {
      position: absolute;
      ${v.auraStyle}
    }

    .logo-img {
      position: relative;
      height: ${logoSize}px;
      width: auto;
      object-fit: contain;
      filter: drop-shadow(0 0 45px rgba(20, 184, 166, 1)) drop-shadow(0 0 20px rgba(255, 255, 255, 0.9));
      transform: scale(0.95);
      animation: logo-zoom 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 14px;
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
      text-shadow: 0 4px 25px rgba(0, 0, 0, 0.9), 0 0 35px rgba(255, 255, 255, 0.5);
    }

    .title-clinico {
      font-size: ${titleSize}px;
      font-weight: 300;
      color: #2dd4bf;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-shadow: 0 0 30px rgba(45, 212, 191, 0.95);
    }

    .tagline {
      font-size: ${subtitleSize}px;
      font-weight: 500;
      color: #cbd5e1;
      letter-spacing: 0.05em;
      margin-bottom: 22px;
      opacity: 0;
      transform: translateY(10px);
      animation: text-reveal 0.8s 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
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
      padding: 7px 18px;
      border-radius: 9999px;
      backdrop-filter: blur(10px);
    }

    .badge-teal {
      color: #2dd4bf;
      background: rgba(20, 184, 166, 0.18);
      border: 1px solid rgba(45, 212, 191, 0.5);
      box-shadow: 0 0 18px rgba(45, 212, 191, 0.25);
    }

    .badge-blue {
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.18);
      border: 1px solid rgba(56, 189, 248, 0.5);
      box-shadow: 0 0 18px rgba(56, 189, 248, 0.25);
    }

    .badge-purple {
      color: #c084fc;
      background: rgba(192, 132, 252, 0.18);
      border: 1px solid rgba(192, 132, 252, 0.5);
      box-shadow: 0 0 18px rgba(192, 132, 252, 0.25);
    }

    .energy-bar {
      width: ${isVertical ? '320px' : '440px'};
      height: 2px;
      background: linear-gradient(90deg, transparent, #2dd4bf, #ffffff, #2dd4bf, transparent);
      margin: 14px 0;
      opacity: 0;
      animation: energy-sweep 2.5s 0.4s ease-out forwards;
      box-shadow: 0 0 15px #2dd4bf;
    }

    @keyframes logo-zoom {
      0% { transform: scale(0.85); opacity: 0; filter: brightness(2) drop-shadow(0 0 60px #2dd4bf); }
      30% { opacity: 1; transform: scale(1.04); }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes text-reveal {
      0% { opacity: 0; transform: translateY(14px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    @keyframes energy-sweep {
      0% { opacity: 0; transform: scaleX(0.1); }
      50% { opacity: 1; transform: scaleX(1); }
      100% { opacity: 0.8; transform: scaleX(0.9); }
    }

    ${v.extraStyles}
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
    ${v.canvasScript(width, height, isVertical)}
  </script>
</body>
</html>`;
}

// -------------------------------------------------------------
// SINTETIZADORES DE ÁUDIO BRANDING PERSONALIZADOS
// -------------------------------------------------------------

function writeWavHeader(buffer: Buffer, dataSize: number, sampleRate: number) {
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // Stereo
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
}

// ÁUDIO 2: HERO NEURAL SUB-DROP (Grave Cinema 808 + Pulso Estéreo)
function generateAudioHeroSubDrop(outputPath: string): string {
  const sampleRate = 48000;
  const duration = 3.6;
  const totalSamples = Math.floor(sampleRate * duration);
  const dataSize = totalSamples * 4;
  const buffer = Buffer.alloc(44 + dataSize);
  writeWavHeader(buffer, dataSize, sampleRate);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    // 1. Sub-bass boom profundo (65Hz descendo para 38Hz com decaimento exponencial)
    let sub = 0;
    if (t < 2.5) {
      const f = 65 * Math.exp(-t * 0.45);
      const env = Math.exp(-t * 0.9) * Math.min(1, t * 15);
      sub = Math.sin(2 * Math.PI * f * t) * env * 0.65;
    }

    // 2. Whoosh digital aéreo rápido (0.0s a 0.7s)
    let air = 0;
    if (t < 0.8) {
      const noise = (Math.random() * 2 - 1) * 0.15;
      const f = 400 + 800 * (t / 0.8);
      const tone = Math.sin(2 * Math.PI * f * t) * 0.15;
      air = (noise + tone) * Math.sin((t / 0.8) * Math.PI);
    }

    // 3. Chime cristalino marcante (Dó Maior 9: C5, E5, G5, B5, D6) a partir de 0.6s
    let chime = 0;
    if (t >= 0.6) {
      const dt = t - 0.6;
      const decay = Math.exp(-dt * 1.8);
      chime = (
        0.30 * Math.sin(2 * Math.PI * 523.25 * dt) +
        0.26 * Math.sin(2 * Math.PI * 659.25 * dt) +
        0.22 * Math.sin(2 * Math.PI * 783.99 * dt) +
        0.18 * Math.sin(2 * Math.PI * 987.77 * dt) +
        0.15 * Math.sin(2 * Math.PI * 1174.66 * dt)
      ) * decay;
    }

    let left = sub + air * 0.9 + chime * 1.05;
    let right = sub + air * 1.1 + chime * 0.95;

    let master = t > 2.8 ? Math.max(0, 1 - (t - 2.8) / 0.8) : 1;
    left *= master;
    right *= master;

    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    buffer.writeInt16LE(Math.floor(clamp(left) * 32767), offset);
    buffer.writeInt16LE(Math.floor(clamp(right) * 32767), offset + 2);
    offset += 4;
  }

  const rawWav = path.join(path.dirname(outputPath), 'temp_hero.wav');
  fs.writeFileSync(rawWav, buffer);
  const cmd = `"${ffmpegPath}" -y -i "${rawWav}" -af "aecho=0.8:0.7:70:0.35" -c:a aac -b:a 192k "${outputPath}"`;
  execSync(cmd, { stdio: 'pipe' });
  try { fs.unlinkSync(rawWav); } catch {}
  return outputPath;
}

// ÁUDIO 3: ZEN CRISTAL (Harpa / Acorde Eufônico Terapêutico 432Hz)
function generateAudioZenCrystal(outputPath: string): string {
  const sampleRate = 48000;
  const duration = 3.6;
  const totalSamples = Math.floor(sampleRate * duration);
  const dataSize = totalSamples * 4;
  const buffer = Buffer.alloc(44 + dataSize);
  writeWavHeader(buffer, dataSize, sampleRate);

  // Notas arpejadas suaves: Lá 432Hz, Dó# 544Hz, Mi 648Hz, Lá 864Hz
  const notes = [
    { t0: 0.1, freq: 432.0, amp: 0.28 },
    { t0: 0.35, freq: 544.3, amp: 0.26 },
    { t0: 0.6, freq: 648.0, amp: 0.24 },
    { t0: 0.85, freq: 864.0, amp: 0.22 },
    { t0: 1.1, freq: 1296.0, amp: 0.16 },
  ];

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    // Pad acolhedor submerso suave (108Hz)
    const pad = Math.sin(2 * Math.PI * 108 * t) * 0.18 * Math.sin(Math.min(1, t / 0.5) * Math.PI * 0.5);

    let left = pad;
    let right = pad;

    for (let n = 0; n < notes.length; n++) {
      const note = notes[n];
      if (t >= note.t0) {
        const dt = t - note.t0;
        const decay = Math.exp(-dt * 1.3);
        const sig = Math.sin(2 * Math.PI * note.freq * dt) * note.amp * decay;
        // Panning estéreo alternado
        const pan = (n % 2 === 0) ? 0.75 : 1.25;
        left += sig * pan;
        right += sig * (2 - pan);
      }
    }

    let master = t > 2.8 ? Math.max(0, 1 - (t - 2.8) / 0.8) : 1;
    left *= master;
    right *= master;

    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    buffer.writeInt16LE(Math.floor(clamp(left) * 32767), offset);
    buffer.writeInt16LE(Math.floor(clamp(right) * 32767), offset + 2);
    offset += 4;
  }

  const rawWav = path.join(path.dirname(outputPath), 'temp_zen.wav');
  fs.writeFileSync(rawWav, buffer);
  const cmd = `"${ffmpegPath}" -y -i "${rawWav}" -af "aecho=0.85:0.8:90:0.45" -c:a aac -b:a 192k "${outputPath}"`;
  execSync(cmd, { stdio: 'pipe' });
  try { fs.unlinkSync(rawWav); } catch {}
  return outputPath;
}

// ÁUDIO 4: QUANTUM CYBER (Impact Riser + Power Bell Estilo Tech Líder)
function generateAudioQuantumCyber(outputPath: string): string {
  const sampleRate = 48000;
  const duration = 3.6;
  const totalSamples = Math.floor(sampleRate * duration);
  const dataSize = totalSamples * 4;
  const buffer = Buffer.alloc(44 + dataSize);
  writeWavHeader(buffer, dataSize, sampleRate);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;

    // 1. Riser de aceleração futurista (sweep ascendente 80Hz -> 450Hz em 0.6s)
    let riser = 0;
    if (t < 0.65) {
      const f = 80 + 370 * Math.pow(t / 0.65, 2);
      riser = Math.sin(2 * Math.PI * f * t) * (t / 0.65) * 0.45;
    }

    // 2. Power bell de cristal e sino digital (acorde Fá Maior 7 com 9ª: F4, A4, C5, E5, G5) aos 0.65s
    let bell = 0;
    if (t >= 0.65) {
      const dt = t - 0.65;
      const decay = Math.exp(-dt * 1.6);
      bell = (
        0.32 * Math.sin(2 * Math.PI * 349.23 * dt) +
        0.28 * Math.sin(2 * Math.PI * 440.00 * dt) +
        0.24 * Math.sin(2 * Math.PI * 523.25 * dt) +
        0.20 * Math.sin(2 * Math.PI * 659.25 * dt) +
        0.16 * Math.sin(2 * Math.PI * 783.99 * dt)
      ) * decay;
    }

    // 3. Sub-drop estabilizador (50Hz) aos 0.65s
    let drop = 0;
    if (t >= 0.65 && t < 2.5) {
      const dt = t - 0.65;
      drop = Math.sin(2 * Math.PI * 50 * dt) * Math.exp(-dt * 1.5) * 0.55;
    }

    let left = riser * 0.9 + bell * 1.05 + drop;
    let right = riser * 1.1 + bell * 0.95 + drop;

    let master = t > 2.8 ? Math.max(0, 1 - (t - 2.8) / 0.8) : 1;
    left *= master;
    right *= master;

    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    buffer.writeInt16LE(Math.floor(clamp(left) * 32767), offset);
    buffer.writeInt16LE(Math.floor(clamp(right) * 32767), offset + 2);
    offset += 4;
  }

  const rawWav = path.join(path.dirname(outputPath), 'temp_cyber.wav');
  fs.writeFileSync(rawWav, buffer);
  const cmd = `"${ffmpegPath}" -y -i "${rawWav}" -af "aecho=0.8:0.75:65:0.35" -c:a aac -b:a 192k "${outputPath}"`;
  execSync(cmd, { stdio: 'pipe' });
  try { fs.unlinkSync(rawWav); } catch {}
  return outputPath;
}

// -------------------------------------------------------------
// RENDERIZADOR DE VÍDEO
// -------------------------------------------------------------

async function renderVariantVideo(
  variant: VariantType,
  isVertical: boolean,
  audioPath: string,
  outputPath: string
) {
  const width = isVertical ? 1080 : 1920;
  const height = isVertical ? 1920 : 1080;
  const orientation = isVertical ? '9x16' : '16x9';

  console.log(`🎬 [${variant}] Gravando ${orientation}...`);

  const htmlContent = getVariantHtml(variant, isVertical);
  const tempRecordDir = path.join(process.cwd(), `public/videos/assets/temp_${variant}_${orientation}`);
  fs.mkdirSync(tempRecordDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width, height },
    recordVideo: {
      dir: tempRecordDir,
      size: { width, height }
    }
  });

  const page = await context.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });
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

  // Muxing com FFmpeg
  const cmd = `"${ffmpegPath}" -y -i "${rawVideoPath}" -i "${audioPath}" -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy -shortest "${outputPath}"`;
  execSync(cmd, { stdio: 'pipe' });

  // Limpeza
  try {
    if (rawVideoPath && fs.existsSync(rawVideoPath)) fs.unlinkSync(rawVideoPath);
    fs.rmSync(tempRecordDir, { recursive: true, force: true });
  } catch {}

  console.log(`  ✅ Vídeo finalizado: ${outputPath}`);
}

async function generatePreviewFrame(videoPath: string, previewPngPath: string) {
  const cmd = `"${ffmpegPath}" -y -ss 00:00:02.0 -i "${videoPath}" -vframes 1 "${previewPngPath}"`;
  execSync(cmd, { stdio: 'pipe' });
}

async function main() {
  const assetsDir = path.join(process.cwd(), 'public/videos/assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  console.log('🚀 Iniciando renderização das 3 Novas Alternativas de Vinheta PREMIUM...');

  // 1. Gera os 3 áudios exclusivos
  console.log('\n🎵 [1/3] Sintetizando áudios cinematográficos...');
  const audioHero = path.join(assetsDir, 'audio_hero_subdrop.aac');
  const audioZen = path.join(assetsDir, 'audio_zen_crystal.aac');
  const audioCyber = path.join(assetsDir, 'audio_quantum_cyber.aac');

  generateAudioHeroSubDrop(audioHero);
  generateAudioZenCrystal(audioZen);
  generateAudioQuantumCyber(audioCyber);

  // 2. Renderiza Alternativa 2 (Hero Sub-Drop - Logo Extra Grande)
  console.log('\n🎨 [2/4] Renderizando Alternativa 2: Hero Neural Sub-Drop (Logo Extra Grande)...');
  const v2_16x9 = path.join(assetsDir, 'synapsis_intro_v2_hero_16x9.mp4');
  const v2_9x16 = path.join(assetsDir, 'synapsis_intro_v2_hero_9x16.mp4');
  await renderVariantVideo('hero_subdrop', false, audioHero, v2_16x9);
  await renderVariantVideo('hero_subdrop', true, audioHero, v2_9x16);
  await generatePreviewFrame(v2_16x9, path.join(assetsDir, 'preview_v2_hero_16x9.png'));
  await generatePreviewFrame(v2_9x16, path.join(assetsDir, 'preview_v2_hero_9x16.png'));

  // 3. Renderiza Alternativa 3 (Zen Crystal - Logo Grande, Humanista)
  console.log('\n🎨 [3/4] Renderizando Alternativa 3: Zen Crystal (Logo Grande, Humanista)...');
  const v3_16x9 = path.join(assetsDir, 'synapsis_intro_v3_zen_16x9.mp4');
  const v3_9x16 = path.join(assetsDir, 'synapsis_intro_v3_zen_9x16.mp4');
  await renderVariantVideo('zen_crystal', false, audioZen, v3_16x9);
  await renderVariantVideo('zen_crystal', true, audioZen, v3_9x16);
  await generatePreviewFrame(v3_16x9, path.join(assetsDir, 'preview_v3_zen_16x9.png'));
  await generatePreviewFrame(v3_9x16, path.join(assetsDir, 'preview_v3_zen_9x16.png'));

  // 4. Renderiza Alternativa 4 (Quantum Cyber - Logo Ultra Gigante)
  console.log('\n🎨 [4/4] Renderizando Alternativa 4: Quantum Cyber (Logo Ultra Gigante)...');
  const v4_16x9 = path.join(assetsDir, 'synapsis_intro_v4_cyber_16x9.mp4');
  const v4_9x16 = path.join(assetsDir, 'synapsis_intro_v4_cyber_9x16.mp4');
  await renderVariantVideo('quantum_cyber', false, audioCyber, v4_16x9);
  await renderVariantVideo('quantum_cyber', true, audioCyber, v4_9x16);
  await generatePreviewFrame(v4_16x9, path.join(assetsDir, 'preview_v4_cyber_16x9.png'));
  await generatePreviewFrame(v4_9x16, path.join(assetsDir, 'preview_v4_cyber_9x16.png'));

  console.log('\n🎉 Todas as 3 novas alternativas foram renderizadas com sucesso em 16:9 e 9:16!');
}

main().catch(console.error);
