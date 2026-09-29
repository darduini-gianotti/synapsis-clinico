import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { TourScene } from './tours/overview-60s.js';

export interface ScreenRecordingResult {
  rawVideoPath: string;
  startOffsetSec: number;
}

export async function smoothClick(
  page: any,
  selectorOrLocator: string | any,
  options: { label?: string; waitAfter?: number } = {}
): Promise<boolean> {
  try {
    const locator = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator).first() : selectorOrLocator;
    if (!(await locator.isVisible({ timeout: 3000 }).catch(() => false))) {
      return false;
    }

    const box = await locator.boundingBox();
    if (!box) {
      await locator.click({ force: true }).catch(() => {});
      return true;
    }

    const targetX = Math.round(box.x + box.width / 2);
    const targetY = Math.round(box.y + box.height / 2);

    // Dispara animação visual do cursor se movendo, spotlight do botão e onda de clique
    await page.evaluate(({ x, y }) => {
      // 1. Move o cursor virtual suavemente até o elemento
      const cursor = document.getElementById('synapsis-virtual-cursor');
      if (cursor) {
        cursor.style.transition = 'top 0.4s cubic-bezier(0.25, 1, 0.5, 1), left 0.4s cubic-bezier(0.25, 1, 0.5, 1), transform 0.15s ease';
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;
        cursor.style.opacity = '1';
      }

      // 2. Destaca o elemento clicado (spotlight pulsante)
      const el = document.elementFromPoint(x, y);
      const targetBtn = el?.closest('button, [role="button"], a, tr, input, [data-sidebar-nav]') as HTMLElement | null;
      if (targetBtn) {
        targetBtn.classList.add('synapsis-btn-highlight');
        setTimeout(() => {
          targetBtn.classList.remove('synapsis-btn-highlight');
        }, 1400);
      }

      // 3. Efeito Ripple / Onda de Choque no ponto exato do clique
      const ripple = document.createElement('div');
      ripple.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(20, 184, 166, 0.9) 0%, rgba(13, 148, 136, 0.4) 50%, transparent 80%);
        border: 2px solid #14b8a6;
        pointer-events: none;
        z-index: 2147483646;
        transform: translate(-50%, -50%) scale(0.2);
        animation: synapsis-ripple-effect 0.6s cubic-bezier(0, 0, 0.2, 1) forwards;
      `;
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 700);
    }, { x: targetX, y: targetY });

    // Aguarda o movimento visual do cursor atingir o botão
    await page.waitForTimeout(350);

    // Executa o clique real na página
    await locator.click({ force: true }).catch(() => {});

    // Aguarda o feedback visual
    await page.waitForTimeout(options.waitAfter || 300);
    return true;
  } catch (err: any) {
    console.warn(`Aviso no smoothClick:`, err.message);
    return false;
  }
}

export async function showIntroSplash(page: any, durationMs: number = 3200) {
  console.log(`  -> Exibindo Vinheta de Abertura com Logo Synapsis Clínico...`);
  await page.evaluate(() => {
    const splash = document.createElement('div');
    splash.id = 'synapsis-intro-splash';
    splash.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(20, 184, 166, 0.45);
        padding: 44px 64px;
        border-radius: 32px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 50px rgba(20, 184, 166, 0.3);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        max-width: 640px;
        animation: synapsis-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <div style="position: relative; margin-bottom: 22px;">
          <div style="position: absolute; inset: -20px; border-radius: 50%; background: radial-gradient(circle, rgba(20, 184, 166, 0.4) 0%, transparent 70%); animation: synapsis-pulse 2s infinite;"></div>
          <img src="/landing/synapsi_brain1.png" style="position: relative; height: 110px; width: auto; object-fit: contain; filter: drop-shadow(0 0 25px rgba(20, 184, 166, 0.9));" />
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="font-size: 42px; font-weight: 900; color: #ffffff; letter-spacing: -0.03em; font-family: sans-serif;">Synapsis</span>
          <span style="font-size: 42px; font-weight: 300; color: #14b8a6; letter-spacing: -0.03em; font-family: sans-serif;">Clínico</span>
        </div>
        <p style="font-size: 16px; font-weight: 500; color: #94a3b8; margin: 0 0 20px 0; font-family: sans-serif; letter-spacing: 0.01em;">Ecossistema de Gestão e Inteligência Clínica</p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;">
          <span style="font-size: 11px; font-weight: 800; color: #14b8a6; background: rgba(20, 184, 166, 0.15); border: 1px solid rgba(20, 184, 166, 0.35); padding: 5px 14px; border-radius: 9999px;">CFP 06/2019</span>
          <span style="font-size: 11px; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); padding: 5px 14px; border-radius: 9999px;">LGPD &amp; AES-256</span>
          <span style="font-size: 11px; font-weight: 800; color: #a855f7; background: rgba(168, 85, 247, 0.15); border: 1px solid rgba(168, 85, 247, 0.35); padding: 5px 14px; border-radius: 9999px;">Copiloto IA</span>
        </div>
      </div>
    `;
    splash.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(2, 6, 23, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 999999;
      opacity: 1;
      transition: opacity 0.5s ease;
    `;
    document.body.appendChild(splash);
  });

  const fadeTime = 500;
  await page.waitForTimeout(Math.max(1000, durationMs - fadeTime));
  await page.evaluate(() => {
    const splash = document.getElementById('synapsis-intro-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 500);
    }
  });
  await page.waitForTimeout(fadeTime);
}

export async function showOutroSplash(page: any, durationMs: number = 3800) {
  console.log(`  -> Exibindo Vinheta de Encerramento com Logo e CTA...`);
  await page.evaluate(() => {
    const splash = document.createElement('div');
    splash.id = 'synapsis-outro-splash';
    splash.innerHTML = `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(20, 184, 166, 0.5);
        padding: 44px 64px;
        border-radius: 32px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.85), 0 0 60px rgba(20, 184, 166, 0.35);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        max-width: 650px;
        animation: synapsis-pop 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <div style="position: relative; margin-bottom: 20px;">
          <div style="position: absolute; inset: -15px; border-radius: 50%; background: radial-gradient(circle, rgba(20, 184, 166, 0.4) 0%, transparent 70%);"></div>
          <img src="/landing/synapsi_brain1.png" style="position: relative; height: 100px; width: auto; object-fit: contain; filter: drop-shadow(0 0 25px rgba(20, 184, 166, 0.9));" />
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
          <span style="font-size: 38px; font-weight: 900; color: #ffffff; letter-spacing: -0.03em; font-family: sans-serif;">Synapsis</span>
          <span style="font-size: 38px; font-weight: 300; color: #14b8a6; letter-spacing: -0.03em; font-family: sans-serif;">Clínico</span>
        </div>
        <p style="font-size: 16px; font-weight: 400; color: #cbd5e1; margin: 0 0 18px 0; font-family: sans-serif; line-height: 1.45;">
          Mais segurança ética para sua clínica, mais tempo para seus pacientes.
        </p>
        <div style="margin-bottom: 16px;">
          <span style="font-size: 13px; font-weight: 800; color: #fbbf24; background: rgba(245, 158, 11, 0.18); border: 1px solid rgba(245, 158, 11, 0.45); padding: 7px 20px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; font-family: sans-serif;">👑 Clube das Fundadoras • 3 Meses Grátis</span>
        </div>
        <div style="
          padding: 14px 32px;
          border-radius: 16px;
          background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
          color: #ffffff;
          font-weight: 800;
          font-size: 15px;
          box-shadow: 0 10px 25px -5px rgba(13, 148, 136, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.2);
          font-family: sans-serif;
          letter-spacing: 0.02em;
        ">
          Acesse: synapsisclinico.com.br
        </div>
      </div>
    `;
    splash.style.cssText = `
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(2, 6, 23, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 999999;
      opacity: 0;
      transition: opacity 0.5s ease;
    `;
    document.body.appendChild(splash);
    requestAnimationFrame(() => {
      splash.style.opacity = '1';
    });
  });
  await page.waitForTimeout(durationMs);
}

export async function recordTourScreen(
  scenes: TourScene[],
  sceneDurations: number[],
  outputDir: string,
  baseUrl: string = 'http://localhost:3333'
): Promise<ScreenRecordingResult> {
  console.log(`🎥 Iniciando gravação de tela com Playwright (1920x1080 60fps)...`);

  // 1. Obtém a sessão de Administrador (Dra. Helena Martins) para acesso total sem restrições
  let adminToken = '';
  let adminUser: any = null;
  try {
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@psicogestao.com.br', password: 'senha123' }),
    });
    const loginData: any = await loginRes.json();
    if (loginData.token) {
      adminToken = loginData.token;
      adminUser = loginData.user;
      console.log(`  -> Sessão de Administrador obtida com sucesso: ${adminUser.name} (${adminUser.role})`);
    }
  } catch (err: any) {
    console.warn(`Aviso ao obter login admin antecipado:`, err.message);
  }

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: outputDir,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();
  const pageCreatedAt = Date.now();

  // Injeta credenciais de Administrador, tema escuro, cursor inteligente e marca d'água permanente com a logo
  await page.addInitScript(({ token, user }) => {
    if (token && user) {
      localStorage.setItem('psico_token', token);
      localStorage.setItem('psico_user', JSON.stringify(user));
    }
    localStorage.setItem('synapsis_theme', 'dark');

    window.addEventListener('DOMContentLoaded', () => {
      // 1. Cursor Virtual de Alta Resolução (Ponteiro moderno com anel pulsante)
      const cursor = document.createElement('div');
      cursor.id = 'synapsis-virtual-cursor';
      cursor.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 8px rgba(0,0,0,0.85));">
          <path d="M4 3L11 21L14.5 13.5L22 10L4 3Z" fill="#14b8a6" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
        <div style="
          position: absolute;
          top: 1px;
          left: 1px;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 2px solid rgba(20, 184, 166, 0.7);
          pointer-events: none;
          animation: synapsis-pulse 1.8s infinite;
        "></div>
      `;
      cursor.style.cssText = `
        position: fixed;
        top: 250px;
        left: 300px;
        width: 28px;
        height: 28px;
        pointer-events: none;
        z-index: 2147483647;
        opacity: 0.9;
        transition: transform 0.15s ease;
      `;
      document.body.appendChild(cursor);

      // 2. Marca D'água / Brand Badge Permanente no Topo Direito (Logo + Nome)
      const brandBadge = document.createElement('div');
      brandBadge.id = 'synapsis-brand-watermark';
      brandBadge.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(15, 23, 42, 0.88);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 8px 18px;
          border-radius: 9999px;
          border: 1px solid rgba(20, 184, 166, 0.4);
          box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 20px rgba(20, 184, 166, 0.25);
        ">
          <img src="/landing/synapsi_brain1.png" style="height: 28px; width: auto; object-fit: contain; filter: drop-shadow(0 0 8px rgba(20, 184, 166, 0.7));" />
          <div style="display: flex; flex-direction: column; line-height: 1.1;">
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="font-size: 14px; font-weight: 900; color: #ffffff; letter-spacing: -0.02em; font-family: sans-serif;">Synapsis</span>
              <span style="font-size: 14px; font-weight: 300; color: #14b8a6; letter-spacing: -0.02em; font-family: sans-serif;">Clínico</span>
            </div>
            <span style="font-size: 9px; font-weight: 700; color: #94a3b8; font-family: sans-serif; text-transform: uppercase; letter-spacing: 0.05em;">Gestão &amp; IA para Saúde Mental</span>
          </div>
        </div>
      `;
      brandBadge.style.cssText = `
        position: fixed;
        top: 12px;
        right: 175px;
        z-index: 99999;
        pointer-events: none;
        user-select: none;
      `;
      document.body.appendChild(brandBadge);

      // 3. Estilos CSS globais para destaques, spotlight e animações
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes synapsis-pulse {
          0% { transform: scale(0.85); opacity: 0.8; }
          50% { transform: scale(1.35); opacity: 0.2; }
          100% { transform: scale(0.85); opacity: 0.8; }
        }
        @keyframes synapsis-ripple-effect {
          0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2.8); opacity: 0; }
        }
        @keyframes synapsis-pop {
          0% { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .synapsis-btn-highlight {
          outline: 3px solid #14b8a6 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 30px rgba(20, 184, 166, 0.95) !important;
          transform: scale(1.04) !important;
          transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
          z-index: 50 !important;
        }
      `;
      document.head.appendChild(style);
    });
  }, { token: adminToken, user: adminUser });

  console.log(`  -> Acessando ${baseUrl}...`);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // Aguarda carregar a interface da aplicação
  try {
    await page.waitForSelector('button:has-text("Agenda"), button:has-text("Pacientes"), [data-sidebar-nav]', {
      timeout: 10000,
    });
    console.log(`  -> Interface do Synapsis Clínico carregada com sucesso!`);
  } catch (e) {
    console.warn(`  -> Aviso: tempo de espera esgotado, prosseguindo com captura...`);
  }

  // Se por ventura caiu na tela de login, preenche como admin
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.log(`  -> Realizando login de fallback como Administrador...`);
    await emailInput.fill('admin@psicogestao.com.br');
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill('senha123');
    const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar")').first();
    await submitBtn.click();
    await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(1500);
  }

  // Pré-aquece os módulos code-split pesados (Financeiro, Avaliações, Agenda) para que não haja nenhum spinner durante o vídeo
  console.log(`  -> Pré-aquecendo módulos da aplicação para garantir transições instantâneas (0ms)...`);
  try {
    const finBtn = page.locator('button:has-text("Financeiro"), [data-tour="nav-financial"]').first();
    if (await finBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await finBtn.click({ force: true });
      await page.waitForTimeout(600);
    }
    const evalBtn = page.locator('button:has-text("Avaliações"), [data-tour="nav-evaluations"]').first();
    if (await evalBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await evalBtn.click({ force: true });
      await page.waitForTimeout(500);
    }
    const agendaBtn = page.locator('button:has-text("Agenda"), [data-tour="nav-agenda"]').first();
    if (await agendaBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await agendaBtn.click({ force: true });
      await page.waitForTimeout(500);
    }
  } catch (e) {}

  // Fecha qualquer modal remanescente ou aviso
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Calcula o offset decorrido de carregamento inicial para que o FFmpeg descarte o pre-load em branco
  const startOffsetSec = Math.max(0, (Date.now() - pageCreatedAt) / 1000);
  console.log(`  -> Offset inicial de carregamento da interface: ${startOffsetSec.toFixed(2)}s (será sincronizado no FFmpeg)`);

  // Executa as cenas sincronizadas com a duração do áudio
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const targetDurationMs = Math.round(sceneDurations[i] * 1000);
    const sceneStart = Date.now();

    console.log(`  -> Executando cena ${i + 1}/${scenes.length}: ${scene.title} (${(targetDurationMs / 1000).toFixed(1)}s)...`);

    try {
      await scene.actions(page);
    } catch (err: any) {
      console.warn(`Aviso durante cena ${scene.title}:`, err.message);
    }

    const elapsedMs = Date.now() - sceneStart;
    const remainingMs = Math.max(0, targetDurationMs - elapsedMs);
    if (remainingMs > 0) {
      await page.waitForTimeout(remainingMs);
    }
  }

  // Pausa final de 1 segundo
  await page.waitForTimeout(1000);

  // Fecha a página e o contexto para gravar o arquivo de vídeo
  const videoObject = page.video();
  await page.close();
  await context.close();
  await browser.close();

  let rawVideoPath = '';
  if (videoObject) {
    rawVideoPath = await videoObject.path();
    console.log(`✅ Gravação de tela finalizada: ${rawVideoPath}`);
  } else {
    const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.webm'));
    if (files.length > 0) {
      rawVideoPath = path.join(outputDir, files[0]);
      console.log(`✅ Gravação de tela encontrada: ${rawVideoPath}`);
    }
  }

  return { rawVideoPath, startOffsetSec };
}


