// Capturas del desplegable de tirar en la app corriendo (`.pen` «Mesa/Tiradas», columnas 1 y 2).
// Mismo criterio que shot-bestiary.mjs: no se da por buena una pantalla que nadie ha mirado.
import { chromium } from 'playwright';
const TABLE = process.env.TABLE ?? '8f506705-e348-415c-82a9-5a37e2c0ce51';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 1100 } });
pg.on('console', m => { if (m.type() === 'error') console.log('CONSOLA:', m.text().slice(0, 200)); });
pg.on('pageerror', e => console.log('ERROR JS:', String(e).slice(0, 240)));

await pg.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await pg.locator('input[type=email]').fill(process.env.EMAIL ?? 'admin@rolvium.local');
await pg.locator('input[type=password]').fill('rolvium123');
await Promise.all([pg.waitForURL(u => !String(u).includes('/login')).catch(() => {}), pg.locator('button[type=submit]').click()]);
await pg.goto(`http://localhost:5173/table/${TABLE}`, { waitUntil: 'networkidle' });
await pg.waitForTimeout(2500);

const ficha = pg.getByRole('button', { name: /^FICHA$/i });
if (await ficha.count()) { await ficha.first().click(); await pg.waitForTimeout(2000); }

// Columna 1 — TIRAR una característica
const stat = pg.locator('[data-stat="cunning"]').first();
console.log('fila de Astucia:', await stat.count());
await stat.getByRole('button', { name: /Tirar/ }).click();
await pg.waitForTimeout(900);
console.log('desplegable:', await pg.getByRole('dialog').count(), '·', (await pg.locator('.ch-pop').innerText().catch(() => '')).replace(/\n/g, ' | '));
await pg.screenshot({ path: '/tmp/tir-caracteristica.png' });
await pg.keyboard.press('Escape');
await pg.waitForTimeout(500);

// Columna 2 — DISPARAR un arma
const shoot = pg.getByRole('button', { name: /Disparar · / }).first();
console.log('botón de disparar:', await shoot.count());
if (await shoot.count()) {
  await shoot.click();
  await pg.waitForTimeout(900);
  console.log('desplegable:', (await pg.locator('.ch-pop').innerText().catch(() => '')).replace(/\n/g, ' | '));
  await pg.screenshot({ path: '/tmp/tir-disparar.png' });
  // Y recortado, para mirarlo de cerca
  const box = await pg.locator('.ch-pop').boundingBox();
  if (box) await pg.screenshot({ path: '/tmp/tir-disparar-cerca.png', clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 } });
}
await b.close();
console.log('ok');
