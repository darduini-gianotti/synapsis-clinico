const { chromium } = require('playwright');
const path = require('path');

const dest = 'C:\\Users\\Sergio DArduini\\.gemini\\antigravity\\brain\\b5675ff9-4c31-450e-af02-daacc28dd1ef';

async function run() {
  const browser = await chromium.launch({ headless: true });
  // Viewport padrão de smartphone iPhone 14 (393 x 852)
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  // Injeta token admin para login imediato
  try {
    const loginRes = await fetch('http://localhost:3333/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@psicogestao.com.br', password: 'senha123' }),
    });
    const data = await loginRes.json();
    if (data.token) {
      await page.addInitScript(({ token, user }) => {
        localStorage.setItem('psico_token', token);
        localStorage.setItem('psico_user', JSON.stringify(user));
        localStorage.setItem('synapsis_theme', 'dark');
      }, { token: data.token, user: data.user });
    }
  } catch (e) {
    console.warn('Erro ao obter token prévio:', e.message);
  }

  console.log('Navegando para o Synapsis Mobile...');
  await page.goto('http://localhost:3333', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Captura da Aba Hoje
  console.log('Capturando Aba Hoje...');
  await page.screenshot({ path: path.join(dest, 'mobile_screenshot_today.png') });

  // 2. Abre o drawer de evolução rápida
  console.log('Abrindo evolução rápida...');
  const evolBtn = page.locator('button:has-text("Evolução")').first();
  if (await evolBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await evolBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(dest, 'mobile_screenshot_evolution.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // 3. Clica na Aba Pacientes
  console.log('Capturando Aba Pacientes...');
  const patientsTabBtn = page.locator('button:has-text("Pacientes")').last();
  if (await patientsTabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await patientsTabBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(dest, 'mobile_screenshot_patients.png') });
  }

  // 4. Clica na Aba Cobranças
  console.log('Capturando Aba Cobranças...');
  const finTabBtn = page.locator('button:has-text("Cobranças")').last();
  if (await finTabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await finTabBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(dest, 'mobile_screenshot_financial.png') });
  }

  // 5. Clica na Aba Menu / Perfil
  console.log('Capturando Aba Menu...');
  const profileTabBtn = page.locator('button:has-text("Menu")').last();
  if (await profileTabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await profileTabBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(dest, 'mobile_screenshot_profile.png') });
  }

  await browser.close();
  console.log('Capturas concluídas com sucesso!');
}

run().catch(console.error);
