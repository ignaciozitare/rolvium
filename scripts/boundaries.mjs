#!/usr/bin/env node
// Comprobador de capas (arquitectura hexagonal) de apps/web y apps/api — CERO dependencias.
// OIH tiene el suyo: scripts/oih-boundaries.mjs.
//
// POR QUÉ EXISTE (2026-10-09). `npm run audit` sólo miraba una dirección (pantallas que
// importan de infraestructura). Nada vigilaba el dominio ni la capa de aplicación de la
// web, y NADA vigilaba el API. Cuando las capas se mezclan no falla ningún test: se
// descubre meses después y toca reescribir. Esto lo comprueba en cada push.
//
// REGLAS (la dependencia siempre apunta hacia dentro):
//   dominio      no importa de application/, infra(structure)/, ui/ ni container;
//                ni de React, Supabase, Fastify o @worksuite/ui.
//   aplicación   no importa de infra(structure)/, ui/ ni container; ni de Supabase o Fastify.
//   pantallas    (sólo web) no importan de infra/ — pasan por container.ts.
// Los `import type` no cuentan (se borran al compilar). Los tests no se miran.
//
// LÍNEA BASE. Lo que ya estaba mal el día que se instaló vive en
// scripts/boundaries-baseline.json y no bloquea: bloquea lo NUEVO. Arreglar una entrada
// y dejarla en el fichero tampoco bloquea, pero se avisa para que se quite.
//
//   node scripts/boundaries.mjs            # sale con 1 si hay una violación nueva
//   node scripts/boundaries.mjs --update   # reescribe la línea base (decisión del dueño)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'scripts/boundaries-baseline.json');
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage', '.vercel']);

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(full, out); }
    else if (/\.[cm]?tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(full);
  }
  return out;
}
const isTest = (f) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(f) || /(^|\/)(tests?|__tests__|__mocks__)\//.test(f);

/** Imports de valor de un fichero: [{ spec, line }]. `import type` y `export type` no cuentan. */
export function extractImports(src) {
  const out = [];
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const re = /(?:^|[\n;])\s*(import|export)\s+(type\s+)?(?:[^'"`;]*?\sfrom\s*)?['"]([^'"]+)['"]|(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const m of clean.matchAll(re)) {
    if (m[2]) continue; // import type / export type
    const spec = m[3] ?? m[4];
    if (!spec) continue;
    if (/^\s*\/\//.test(clean.slice(clean.lastIndexOf('\n', m.index + 1) + 1, m.index + m[0].length))) continue;
    out.push({ spec, line: clean.slice(0, m.index + m[0].length).split('\n').length });
  }
  return out;
}

/** Capa de un fichero (ruta relativa al repo), o null si no pertenece a ninguna vigilada. */
export function layerOf(rel) {
  let m = rel.match(/^apps\/web\/src\/(?:modules\/[^/]+|shared)\/(domain|application|ui)\//);
  if (m) return { app: 'web', layer: m[1] };
  m = rel.match(/^apps\/api\/src\/(domain|application)\//);
  if (m) return { app: 'api', layer: m[1] };
  return null;
}

const FORBIDDEN_PKG = {
  domain: /^(react|react-dom|fastify|@fastify\/.+|@supabase\/.+|@worksuite\/ui)(\/|$)/,
  application: /^(fastify|@fastify\/.+|@supabase\/.+)(\/|$)/,
  ui: null,
};
const FORBIDDEN_DIR = {
  domain: /\/(application|infra|infrastructure|ui)\/|\/container(\.[cm]?[jt]s)?$/,
  application: /\/(infra|infrastructure|ui)\/|\/container(\.[cm]?[jt]s)?$/,
  ui: /\/(infra|infrastructure)\//,
};

/** Motivo por el que `spec`, importado desde `rel` (capa `layer`), rompe la regla — o null. */
export function violation(rel, layer, spec) {
  if (spec.startsWith('.') || spec.startsWith('@/')) {
    const target = spec.startsWith('@/')
      ? `apps/web/src/${spec.slice(2)}`
      : path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
    const probe = `/${target}`;
    const m = probe.match(FORBIDDEN_DIR[layer.layer]);
    return m ? `${layer.layer} importa de ${m[0].replace(/^\/|\/$/g, '').replace(/\.[cm]?[jt]s$/, '')}` : null;
  }
  const pkg = FORBIDDEN_PKG[layer.layer];
  return pkg && pkg.test(spec) ? `${layer.layer} importa el paquete ${spec}` : null;
}

export function scan(root = ROOT) {
  const found = [];
  for (const dir of ['apps/web/src', 'apps/api/src']) {
    for (const file of walk(path.join(root, dir))) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      if (isTest(rel)) continue;
      const layer = layerOf(rel);
      if (!layer) continue;
      for (const { spec, line } of extractImports(fs.readFileSync(file, 'utf8'))) {
        const why = violation(rel, layer, spec);
        if (why) found.push({ file: rel, line, spec, why, key: `${rel} -> ${spec}` });
      }
    }
  }
  return found;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = scan();
  const keys = [...new Set(found.map((v) => v.key))].sort();
  if (process.argv.includes('--update')) {
    fs.writeFileSync(BASELINE, JSON.stringify({ note: 'Violaciones de capas que ya existían. No añadir a mano: se arreglan y se quitan.', known: keys }, null, 2) + '\n');
    console.log(`Línea base reescrita: ${keys.length} violaciones conocidas.`);
    process.exit(0);
  }
  let known = [];
  try { known = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).known ?? []; } catch { /* sin línea base: todo es nuevo */ }
  const knownSet = new Set(known);
  const fresh = found.filter((v) => !knownSet.has(v.key));
  const fixed = known.filter((k) => !keys.includes(k));

  console.log(`\nCapas (web + API): ${found.length} violaciones · ${found.length - fresh.length} ya conocidas · ${fresh.length} NUEVAS`);
  for (const v of fresh) console.log(`  ✗ ${v.file}:${v.line}  ${v.why}  (${v.spec})`);
  if (fixed.length) {
    console.log(`\n${fixed.length} entrada(s) de la línea base ya están arregladas — quitarlas con: node scripts/boundaries.mjs --update`);
    for (const k of fixed.slice(0, 10)) console.log(`  · ${k}`);
  }
  if (fresh.length) {
    console.log('\n✗ Hay violaciones de capas NUEVAS. El dominio no conoce la infraestructura; las pantallas pasan por container.ts.\n');
    process.exit(1);
  }
  console.log('✓ Ninguna violación nueva.\n');
}
