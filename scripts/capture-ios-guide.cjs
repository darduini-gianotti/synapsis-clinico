const { chromium } = require('playwright');
const path = require('path');

const dest = 'C:\\Users\\Sergio DArduini\\.gemini\\antigravity\\brain\\b5675ff9-4c31-450e-af02-daacc28dd1ef';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

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
  } catch (e) {}

  await page.goto('http://localhost:3333', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  // 1. Clica na aba Menu
  await page.locator('nav button:has-text("Menu")').click();
  await page.waitForTimeout(600);

  // 2. Clica em "Como instalar" para abrir o guia
  await page.locator('button:has-text("Instalar App no Smartphone")').click();
  await page.waitForTimeout(600);

  // 3. Garante que a aba do iOS está selecionada
  const iosBtn = page.locator('button:has-text("iPhone (iOS)")');
  if (await iosBtn.isVisible().catch(() => false)) {
    await iosBtn.click();
    await page.waitForTimeout(500);
  }

  // 4. Captura tela
  await page.screenshot({ path: path.join(dest, 'mobile_screenshot_ios_install.png') });
  await browser.close();
  console.log('Screenshot do guia iOS capturado com sucesso!');
}

run().catch(console.error);
