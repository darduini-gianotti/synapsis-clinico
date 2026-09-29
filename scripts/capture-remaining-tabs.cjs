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
  await page.waitForTimeout(1500);

  // 1. Clica na aba Pacientes
  console.log('Capturando Pacientes...');
  await page.locator('nav button:has-text("Pacientes")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dest, 'mobile_screenshot_patients.png') });

  // 2. Clica na aba Cobranças
  console.log('Capturando Cobranças...');
  await page.locator('nav button:has-text("Cobranças")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dest, 'mobile_screenshot_financial.png') });

  // 3. Clica na aba Menu
  console.log('Capturando Menu...');
  await page.locator('nav button:has-text("Menu")').click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(dest, 'mobile_screenshot_profile.png') });

  await browser.close();
  console.log('Finalizado com sucesso!');
}

run().catch(console.error);
