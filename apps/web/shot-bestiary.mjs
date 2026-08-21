// Capturas del Bestiario en la app corriendo. Mismo criterio que scripts/shot.mjs: no se sube una
// pantalla que nadie ha mirado.
import { chromium } from 'playwright';
const TABLE = process.env.TABLE ?? '8f506705-e348-415c-82a9-5a37e2c0ce51';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 1200 } });
pg.on('console', m => { if (m.type() === 'error') console.log('CONSOLA:', m.text().slice(0, 160)); });
pg.on('pageerror', e => console.log('ERROR JS:', String(e).slice(0, 200)));

await pg.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await pg.locator('input[type=email]').fill('admin@rolvium.local');
await pg.locator('input[type=password]').fill('rolvium123');
await Promise.all([pg.waitForURL(u => !String(u).includes('/login')).catch(() => {}), pg.locator('button[type=submit]').click()]);
await pg.goto(`http://localhost:5173/table/${TABLE}`, { waitUntil: 'networkidle' });
await pg.waitForTimeout(2500);

const tab = pg.getByRole('button', { name: /BESTIARIO/i });
console.log('pestaña Bestiario encontrada:', await tab.count());
await tab.first().click();
await pg.waitForTimeout(2500);
await pg.screenshot({ path: '/tmp/bs-catalogo.png', fullPage: false });
console.log('fichas en pantalla:', await pg.locator('article').count());

// ficha de encuentro: duplicar una del manual
const dup = pg.getByRole('button', { name: 'Duplicar' }).first();
if (await dup.count()) {
  await dup.click();
  await pg.waitForTimeout(2000);
  await pg.screenshot({ path: '/tmp/bs-ficha.png' });
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(800);
}

// modal de la foto
const eye = pg.getByRole('button', { name: /Ver la foto de/ }).first();
if (await eye.count()) {
  await eye.click({ force: true });
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path: '/tmp/bs-foto.png' });
  await pg.keyboard.press('Escape');
  await pg.waitForTimeout(800);
}

// PNJ con ficha completa
const npc = pg.getByRole('button', { name: /Nuevo PNJ con ficha/ });
if (await npc.count()) {
  await npc.click();
  await pg.waitForTimeout(2500);
  await pg.screenshot({ path: '/tmp/bs-pnj.png' });
}
console.log('ok', pg.url());

// Desplegable de tirada de la criatura (rechazo n.º 2 del dueño)
await pg.keyboard.press('Escape');
await pg.waitForTimeout(600);
const tirar = pg.getByRole('button', { name: 'Tirar' }).first();
if (await tirar.count()) {
  await tirar.click();
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: '/tmp/bs-tirada.png' });
  console.log('desplegable de tirada capturado');
}
await b.close();
