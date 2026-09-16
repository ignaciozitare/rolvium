/**
 * SACAR LAS SILUETAS DE LOS OBJETOS YA SUBIDOS (specs/modules/maps/SPEC.md § 6.9).
 *
 * Los objetos que se subieron antes de que existiera la silueta nacieron con el rectángulo. Los que se suban
 * a partir de ahora la sacan solos, dentro de la misma pasada que ya comprime la imagen — así que esto es un
 * trabajo de UNA SOLA VEZ, y por eso es un script y no un botón en la aplicación (decisión del dueño,
 * 2026-09-16: «*¿por qué no lo haces automáticamente, por qué un botón?*»).
 *
 * QUÉ HACE: baja cada foto, le saca la silueta con el MISMO motor que usa la aplicación
 * (`silhouetteRing` de `@rolvium/core` — aquí no hay una segunda verdad geométrica) y ESCRIBE UN FICHERO DE
 * MIGRACIÓN. No toca ninguna base de datos: la migración se aplica por el camino de siempre, se puede leer
 * antes, y queda en el repositorio como cualquier otro cambio de esquema.
 *
 * POR QUÉ UN NAVEGADOR: descodificar WebP con transparencia necesita un descodificador de imágenes, y Node no
 * trae ninguno. Playwright ya está en el proyecto (se usa para reproducir fallos), así que se abre un Chromium
 * sin ventana y se le pasan los BYTES — la página no sale a la red, así que no hay ni CORS ni lienzo manchado.
 *
 * USO:
 *   npx tsx scripts/gen-silhouettes.mjs --ids <fichero con un id por línea> [--base <url de supabase>]
 *   npx tsx scripts/gen-silhouettes.mjs --ids ids.txt --out supabase/migrations/2026…_siluetas.sql
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { SILHOUETTE_ALPHA, SILHOUETTE_POINTS, silhouetteRing } from '../packages/core/src/props.ts';

/** El lado al que se lee la opacidad. El mismo que usa la aplicación (`ALPHA_SIDE` en `@rolvium/ui`). */
const ALPHA_SIDE = 256;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const base = arg('base', 'https://scfspsiemikfcnqteonq.supabase.co');
const idsFile = arg('ids', null);
const out = arg('out', 'supabase/migrations/siluetas.sql');
if (!idsFile) {
  console.error('Falta --ids <fichero con un id por línea>');
  process.exit(1);
}

const ids = readFileSync(idsFile, 'utf8').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
const urlOf = id => `${base}/storage/v1/object/public/backgrounds/props/${id}.webp`;

/**
 * La opacidad de una imagen, leída dentro del navegador. Se le entregan los bytes en base64 y los convierte en
 * un `Blob` suyo: nunca sale a la red, así que el lienzo no se mancha y `getImageData` no revienta.
 */
const LEER_ALFA = async ({ b64, side }) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const bmp = await createImageBitmap(new Blob([bytes]));
  const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.floor(bmp.width * k)), h = Math.max(1, Math.floor(bmp.height * k));
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;
  const alpha = new Array(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3];
  return { alpha, width: w, height: h };
};

const browser = await chromium.launch();
const page = await browser.newPage();
const hechas = [];
const fallidas = [];

for (const [i, id] of ids.entries()) {
  process.stdout.write(`\r${i + 1}/${ids.length}  ${id.slice(0, 8)}…   `);
  try {
    const res = await fetch(urlOf(id));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    const { alpha, width, height } = await page.evaluate(LEER_ALFA, { b64, side: ALPHA_SIDE });
    const ring = silhouetteRing(alpha, width, height);
    if (ring.length < 3) throw new Error('sin contorno');
    hechas.push({ id, ring });
  } catch (e) {
    fallidas.push({ id, por: e instanceof Error ? e.message : String(e) });
  }
}
await browser.close();
process.stdout.write('\r');

/*
 * La migración. Una sentencia por objeto y con su propio filtro `default_silhouette IS NULL`, así que volver a
 * aplicarla no pisa nada: si alguien ya le sacó la silueta a uno, se queda la suya. Y la FORMA sólo cambia si
 * sigue siendo el rectángulo de fábrica — un óvalo puesto a mano es una decisión suya y aquí no se revoca.
 */
const sql = [
  '-- ─────────────────────────────────────────────────────────────────────────────',
  '-- LAS SILUETAS DE LOS OBJETOS QUE YA ESTABAN SUBIDOS (§ 6.9)',
  '--',
  `-- Generado por \`scripts/gen-silhouettes.mjs\` el ${new Date().toISOString().slice(0, 10)} a partir de las`,
  `-- fotos que ya están en el bucket, con el MISMO motor que la aplicación (${SILHOUETTE_POINTS} puntos,`,
  `-- corte de opacidad al ${Math.round(SILHOUETTE_ALPHA * 100)} %).`,
  '--',
  `-- ${hechas.length} objetos con silueta · ${fallidas.length} sin ella (se quedan con su rectángulo).`,
  '--',
  '-- Repetible: cada sentencia sólo toca la fila si sigue SIN silueta, y la forma sólo cambia si sigue siendo',
  '-- el rectángulo de fábrica. Y LO YA PLANTADO se arregla al final, que es lo que él ve en sus mapas.',
  '-- ─────────────────────────────────────────────────────────────────────────────',
  '',
  ...hechas.map(({ id, ring }) =>
    `UPDATE public.maps_props SET default_silhouette = '${JSON.stringify(ring)}'::jsonb,\n` +
    `  default_block_shape = CASE WHEN default_block_shape = 'rect' THEN 'silhouette' ELSE default_block_shape END\n` +
    `  WHERE id = '${id}' AND default_silhouette IS NULL;`),
  '',
  '-- LO YA PLANTADO EN LOS MAPAS. Son COPIAS: sin esto no cambiaría una sola de las sombras que ya tiene',
  '-- puestas. Sólo las que siguen con la forma de fábrica, y sólo desde un objeto que de verdad pasó a silueta.',
  'UPDATE public.maps_scene_props sp',
  "   SET silhouette = p.default_silhouette, block_shape = 'silhouette'",
  '  FROM public.maps_props p',
  ' WHERE sp.prop_id = p.id',
  "   AND sp.block_shape = 'rect'",
  '   AND sp.silhouette IS NULL',
  "   AND p.default_block_shape = 'silhouette'",
  '   AND p.default_silhouette IS NOT NULL;',
  '',
].join('\n');

writeFileSync(out, sql);
console.log(`✓ ${hechas.length} siluetas · ✗ ${fallidas.length} sin contorno`);
for (const f of fallidas) console.log(`  ✗ ${f.id} — ${f.por}`);
console.log(`→ ${out}`);
