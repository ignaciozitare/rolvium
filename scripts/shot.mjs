// Captura la ficha en la app corriendo, para poder MIRAR lo que se cambia antes de subirlo.
//
// Existe porque el 2026-08-19 se subió a producción una tanda entera de rediseño de la ficha
// validada sólo con tests unitarios y medidas de contraste, y se veía mal: un `span: 2` dejó la
// tarjeta de Estado con un vacío enorme, y las listas de Dones y Equipo salían a tres líneas por
// objeto. Nada de eso lo detecta un test; se ve mirando. Orden del dueño: no volver a trabajar a
// ciegas en pantallas.
//
// Uso:  npm run db:start && npm run dev:api && npm run dev:web
//       node scripts/shot.mjs            → /tmp/full.png y /tmp/sec-<seccion>.png
//       TABLE=<uuid> node scripts/shot.mjs
import { chromium } from 'playwright';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1600, height: 1400 } });
await pg.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
await pg.locator('input[type=email]').fill('admin@rolvium.local');
await pg.locator('input[type=password]').fill('rolvium123');
await Promise.all([pg.waitForURL(u => !String(u).includes('/login')).catch(()=>{}), pg.locator('button[type=submit]').click()]);
await pg.goto(`http://localhost:5173/table/${process.env.TABLE ?? '8f506705-e348-415c-82a9-5a37e2c0ce51'}`, { waitUntil: 'networkidle' });
await pg.waitForTimeout(3500);
const gifts = pg.locator('[data-section="gifts"]');
if (await gifts.count()) { await gifts.scrollIntoViewIfNeeded(); await pg.waitForTimeout(400); }
await pg.screenshot({ path: '/tmp/full.png', fullPage: true });
for (const s of ['identity', 'stats', 'gifts', 'equipment', 'armour', 'state', 'weapons']) {
  const el = pg.locator(`[data-section="${s}"]`);
  if (await el.count()) await el.first().screenshot({ path: `/tmp/sec-${s}.png` });
}
console.log('ok', pg.url());
await b.close();
