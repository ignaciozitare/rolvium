#!/usr/bin/env node
// Rolvium deterministic compliance audit — ZERO LLM tokens.
//
// Plain grep-style scanning of the mechanical rules in CLAUDE.md. Run this
// FIRST and FREE before ever reaching for LLM agents.
//
//   npm run audit                    # full report, always exits 0
//   node scripts/audit.mjs --strict  # exits 1 if any HARD violation (CI gate)
//
// HARD violations: things CLAUDE.md marks zero-tolerance.
// WARN: drift worth reviewing, too noisy to block on.
//
// This file has no dependencies on purpose — it must run anywhere, including CI.
// Every directory read is guarded: the script must print all sections even on
// a mostly-empty tree.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STRICT = process.argv.includes('--strict');

// ─────────────────────────────────────────────────────────────────────────────
// tiny fs helpers
// ─────────────────────────────────────────────────────────────────────────────
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.vercel', 'coverage', '.next']);

function walk(dir, exts, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, exts, out);
    } else if (exts.some((x) => e.name.endsWith(x))) {
      out.push(full);
    }
  }
  return out;
}

const rel = (f) => path.relative(ROOT, f);
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } };
const lines = (f) => read(f).split('\n');
const isTest = (f) => /\.(test|spec)\.[tj]sx?$/.test(f) || /__mocks__|__tests__|\/tests\//.test(f);
const listDirs = (dir) => {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { return []; }
};

// ─────────────────────────────────────────────────────────────────────────────
// findings collector
// ─────────────────────────────────────────────────────────────────────────────
const hard = [];   // { check, file, line, msg }
const warn = [];
const H = (check, file, line, msg) => hard.push({ check, file: rel(file), line, msg });
const W = (check, file, line, msg) => warn.push({ check, file: rel(file), line, msg });

const webSrc = path.join(ROOT, 'apps/web/src');
const apiSrc = path.join(ROOT, 'apps/api/src');
const pkgDir = path.join(ROOT, 'packages');
const migDir = path.join(ROOT, 'supabase/migrations');
const modulesDir = path.join(webSrc, 'modules');

const webTsx = walk(webSrc, ['.ts', '.tsx']);
const apiTs = walk(apiSrc, ['.ts']);
const migSql = walk(migDir, ['.sql']);
// design rules apply to the host app + every package's UI, EXCEPT packages/ui
// itself: the kit is the source of the tokens and is ported verbatim (the
// original audit never scanned its own kit). Flip UI_KIT_EXEMPT to include it.
const UI_KIT_EXEMPT = true;
const pkgTsx = walk(pkgDir, ['.ts', '.tsx']).filter((f) => !(UI_KIT_EXEMPT && /\/packages\/ui\//.test(f)));
const designTsx = [...webTsx, ...pkgTsx];

// token-definition files exempt from design-token rules
const isTokenFile = (f) =>
  /RolviumApp\.css$/.test(f) ||
  /packages\/ui\/src\/tokens\/index\.css$/.test(f) ||
  /theme\.ts$/.test(f) ||
  /tokens?\.(ts|css)$/.test(f);

// ─────────────────────────────────────────────────────────────────────────────
// 1. HEXAGONAL — /ui/ files must not touch infra or do direct I/O  (HARD)
// ─────────────────────────────────────────────────────────────────────────────
const uiFiles = webTsx.filter((f) => /\/ui\//.test(f) && !isTest(f));
for (const f of uiFiles) {
  lines(f).forEach((ln, i) => {
    const n = i + 1;
    // import from infra (type-only import is softer: no runtime coupling)
    if (/\bimport\b/.test(ln) &&
        /\bfrom\s+['"][^'"]*(\/infra\/|@\/shared\/infra|\.\.\/infra|\.\.\/\.\.\/infra)/.test(ln)) {
      const typeOnly = /\bimport\s+type\b/.test(ln);
      (typeOnly ? W : H)('hexagonal', f, n,
        `/ui/ imports${typeOnly ? ' type from' : ''} infra → use container.ts/domain:  ${ln.trim().slice(0, 90)}`);
    }
    // direct supabase I/O in UI — require a string-literal table arg so we don't
    // match Array.from(...), date helpers, or use-case methods like createClient().
    if (/\b(supabase|sb|db|client)\s*\.\s*from\s*\(\s*['"`]/.test(ln)) {
      H('hexagonal', f, n, `/ui/ does direct Supabase I/O:  ${ln.trim().slice(0, 90)}`);
    }
    if (/(^|[^.\w])fetch\s*\(\s*['"`]https?:/.test(ln)) {
      H('hexagonal', f, n, `/ui/ calls external fetch():  ${ln.trim().slice(0, 90)}`);
    }
  });
}

// modules with an infra/ dir but no container.ts  (WARN)
for (const m of listDirs(modulesDir)) {
  const hasInfra = fs.existsSync(path.join(modulesDir, m, 'infra'));
  const hasContainer = fs.existsSync(path.join(modulesDir, m, 'container.ts'));
  if (hasInfra && !hasContainer) {
    W('container', path.join(modulesDir, m), 0, `module "${m}" has infra/ but no container.ts`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AUTH CANARY — apps/api must not decode JWTs without verifying  (HARD)
// ─────────────────────────────────────────────────────────────────────────────
// Manually splitting a token and base64-decoding a part is the classic
// "trust the payload without checking the signature" bug. Any real verifier
// (jwtVerify / jwt.verify / auth.getUser) must be present in the same file.
for (const f of apiTs) {
  if (isTest(f)) continue;
  const src = read(f);
  const hasRealVerify =
    /\bjwtVerify\b/.test(src) || /\bjwt\.verify\s*\(/.test(src) ||
    /app\.jwt\.verify\s*\(/.test(src) || /auth\.getUser\s*\(/.test(src) ||
    /\.getUser\s*\(\s*token/.test(src);
  lines(f).forEach((ln, i) => {
    const decodesPart =
      /Buffer\.from\s*\([^)]*(split\s*\(\s*['"]\.['"]\s*\)|\[\s*1\s*\]|parts?\b|segments?\b|payload\b|token\b)[^)]*,\s*['"]base64(url)?['"]\s*\)/.test(ln) ||
      /\batob\s*\([^)]*(split\s*\(\s*['"]\.['"]\s*\)|\[\s*1\s*\]|payload\b|token\b)/.test(ln);
    if (decodesPart && !hasRealVerify) {
      H('AUTH-BYPASS', f, i + 1,
        `JWT payload decoded via base64 without any signature verification in this file (jwtVerify/jwt.verify/getUser):  ${ln.trim().slice(0, 80)}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SECRETS — no hardcoded keys/tokens/passwords in source  (HARD)
// ─────────────────────────────────────────────────────────────────────────────
const secretPatterns = [
  [/\bsk-[A-Za-z0-9]{16,}/, 'OpenAI-style secret key'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./, 'hardcoded JWT'],
  [/['"`]Bearer\s+[A-Za-z0-9._-]{16,}['"`]/, 'hardcoded Bearer token'],
  [/\b(password|passwd|secret|api[_-]?token|apikey|api[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'hardcoded secret literal'],
];
for (const f of [...webTsx, ...apiTs, ...walk(pkgDir, ['.ts', '.tsx'])]) {  // secrets: scan packages/ui too
  if (isTest(f) || /\.env/.test(f)) continue;
  lines(f).forEach((ln, i) => {
    for (const [re, label] of secretPatterns) {
      if (re.test(ln) && !/process\.env|import\.meta\.env|placeholder|example|xxxx|<your/i.test(ln)) {
        H('secret', f, i + 1, `${label}:  ${ln.trim().slice(0, 80)}`);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MIGRATIONS — RLS + no anon grants  (TO anon = HARD; missing RLS = WARN)
// ─────────────────────────────────────────────────────────────────────────────
for (const f of migSql) {
  const src = read(f);
  const ls = src.split('\n');
  ls.forEach((ln, i) => {
    if (ln.trim().startsWith('--')) return;           // skip SQL comment lines
    const code = ln.replace(/--.*$/, '');             // strip trailing comment
    if (/\bTO\s+anon\b/i.test(code)) {
      H('rls-anon', f, i + 1, `policy/grant TO anon (must be authenticated):  ${ln.trim().slice(0, 80)}`);
    }
  });
  const createsTable = /\bCREATE\s+TABLE\b/i.test(src);
  const enablesRls = /ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(src);
  if (createsTable && !enablesRls) {
    const ln = ls.findIndex((l) => /\bCREATE\s+TABLE\b/i.test(l)) + 1;
    W('rls', f, ln, 'CREATE TABLE without ENABLE ROW LEVEL SECURITY in same file — verify RLS is added (maybe in another migration)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. XSS — dangerouslySetInnerHTML should go through the sanitizer  (WARN)
// ─────────────────────────────────────────────────────────────────────────────
for (const f of designTsx) {
  if (isTest(f)) continue;
  lines(f).forEach((ln, i) => {
    if (/dangerouslySetInnerHTML/.test(ln)) {
      const ctx = lines(f).slice(Math.max(0, i - 3), i + 1).join(' ');
      const sanitized = /sanitize/i.test(ctx);
      W('xss', f, i + 1,
        `dangerouslySetInnerHTML${sanitized ? ' (sanitize nearby — verify)' : ' WITHOUT nearby sanitize() — likely stored XSS'}`);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. DESIGN TOKENS — no #fff / raw fontSize px / var() fallbacks / emojis (WARN)
// ─────────────────────────────────────────────────────────────────────────────
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
let dPureWhite = 0, dFontPx = 0, dFallback = 0, dEmoji = 0;
for (const f of designTsx) {
  if (isTest(f) || isTokenFile(f) || !f.endsWith('.tsx')) continue;
  lines(f).forEach((ln, i) => {
    const n = i + 1;
    if (/['"`]#(fff|ffffff|FFF|FFFFFF)['"`]/.test(ln)) { dPureWhite++; if (dPureWhite <= 15) W('design:#fff', f, n, `pure white banned:  ${ln.trim().slice(0, 70)}`); }
    if (/\bfontSize\s*:\s*['"]?\d/.test(ln)) { dFontPx++; if (dFontPx <= 15) W('design:fontSize', f, n, `raw fontSize px (use var(--rv-text-*)):  ${ln.trim().slice(0, 70)}`); }
    if (/var\(\s*--[\w-]+\s*,/.test(ln)) { dFallback++; if (dFallback <= 10) W('design:var-fallback', f, n, `forbidden var() fallback:  ${ln.trim().slice(0, 70)}`); }
    if (EMOJI.test(ln) && !/\/\//.test(ln.slice(0, ln.search(EMOJI)))) { dEmoji++; if (dEmoji <= 10) W('design:emoji', f, n, `emoji in UI (use Material Symbols):  ${ln.trim().slice(0, 60)}`); }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. UI REUSE — locally reinvented components + @rolvium/ui adoption  (WARN)
// ─────────────────────────────────────────────────────────────────────────────
// The measured pain: modules hand-roll a modal/button when @rolvium/ui ships
// one. This reports offenders + the adoption %, so the user can verify no
// duplication crept in without reading code. See packages/ui/CATALOG.md.
{
  const uiIndex = read(path.join(ROOT, 'packages/ui/src/index.ts'));
  const pkgHasModal = /\bModal\b/.test(uiIndex);
  const pkgHasBtn = /\bBtn\b/.test(uiIndex);

  const moduleUi = webTsx.filter((f) => /\/ui\//.test(f) && !isTest(f) && f.endsWith('.tsx'));
  let usesUiPkg = 0, localModals = 0, localBtns = 0;
  for (const f of moduleUi) {
    const src = read(f);
    if (/from\s+['"]@rolvium\/ui['"]/.test(src)) usesUiPkg++;

    const importsModal = /import\s*\{[^}]*\b(Modal|ConfirmModal)\b[^}]*\}\s*from\s*['"]@rolvium\/ui['"]/.test(src);
    const looksLikeDialog =
      /role\s*=\s*['"]dialog['"]/.test(src) ||
      (/position\s*:\s*['"]fixed['"]/.test(src) && /z-?index|zIndex/i.test(src) && /onClose|backdrop|overlay/i.test(src));
    if (pkgHasModal && looksLikeDialog && !importsModal) {
      localModals++;
      const ls = lines(f);
      const at = ls.findIndex((ln) => /role\s*=\s*['"]dialog['"]/.test(ln) || /position\s*:\s*['"]fixed['"]/.test(ln));
      if (localModals <= 30) {
        W('ui-reuse', f, at + 1, 'local overlay/dialog — reuse Modal/ConfirmModal from @rolvium/ui?');
      }
    }

    const importsBtn = /import\s*\{[^}]*\bBtn\b[^}]*\}\s*from\s*['"]@rolvium\/ui['"]/.test(src);
    if (pkgHasBtn && !importsBtn) {
      lines(f).forEach((ln, i) => {
        if (/<button\b[^>]*\bstyle\s*=\s*\{/.test(ln)) {
          localBtns++;
          if (localBtns <= 30) W('ui-reuse', f, i + 1, `inline-styled <button> — reuse Btn from @rolvium/ui?  ${ln.trim().slice(0, 60)}`);
        }
      });
    }
  }
  const pct = moduleUi.length ? Math.round((usesUiPkg / moduleUi.length) * 100) : 0;
  W('ui-reuse', webSrc, 0,
    `@rolvium/ui adoption: ${usesUiPkg}/${moduleUi.length} UI files (${pct}%) · ${localModals} with local modal/overlay · ${localBtns} inline-styled <button>`);

  // Catalog freshness: every exported component must appear in CATALOG.md.
  const cat = read(path.join(ROOT, 'packages/ui/CATALOG.md'));
  if (uiIndex && cat) {
    const exported = new Set();
    const re = /export\s*\{([^}]*)\}\s*from\s*['"]\.\/components\/[^'"]+['"]/g;
    let m;
    while ((m = re.exec(uiIndex))) {
      for (let id of m[1].split(',')) {
        id = id.trim().split(/\s+as\s+/).pop().trim();
        if (id && /^[A-Z]/.test(id) && !/^[A-Z0-9_]+$/.test(id)) exported.add(id);
      }
    }
    const missing = [...exported].filter((c) => !new RegExp(`\`${c}\``).test(cat));
    if (missing.length) {
      W('ui-reuse', path.join(ROOT, 'packages/ui/CATALOG.md'), 0,
        `catalog stale — missing ${missing.join(', ')}. Run: npm run ui:catalog`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. i18n — es/en leaf-key parity  (mismatch = WARN)
// ─────────────────────────────────────────────────────────────────────────────
function leafKeys(obj, prefix = '', set = new Set()) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) leafKeys(v, `${prefix}${k}.`, set);
    else set.add(`${prefix}${k}`);
  }
  return set;
}
{
  const localesDir = path.join(ROOT, 'packages/i18n/locales');
  const esPath = path.join(localesDir, 'es.json');
  const enPath = path.join(localesDir, 'en.json');
  if (fs.existsSync(esPath) && fs.existsSync(enPath)) {
    try {
      const es = leafKeys(JSON.parse(read(esPath)));
      const en = leafKeys(JSON.parse(read(enPath)));
      const onlyEs = [...es].filter((k) => !en.has(k));
      const onlyEn = [...en].filter((k) => !es.has(k));
      if (onlyEs.length || onlyEn.length) {
        W('i18n', localesDir, 0,
          `es/en key mismatch: ${onlyEs.length} only-in-es, ${onlyEn.length} only-in-en (e.g. ${[...onlyEs, ...onlyEn].slice(0, 3).join(', ')})`);
      }
    } catch (e) {
      W('i18n', localesDir, 0, `locales unparseable: ${e.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// report
// ─────────────────────────────────────────────────────────────────────────────
const C = { red: '\x1b[31m', yel: '\x1b[33m', grn: '\x1b[32m', dim: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
const group = (arr) => arr.reduce((m, f) => ((m[f.check] ??= []).push(f), m), {});

console.log(`\n${C.b}Rolvium compliance audit${C.x} ${C.dim}(deterministic · 0 tokens${STRICT ? ' · strict' : ''})${C.x}`);
console.log(`${C.dim}scanned ${webTsx.length} web + ${apiTs.length} api + ${designTsx.length - webTsx.length} package files, ${migSql.length} migrations${C.x}\n`);

const SECTIONS = [
  ['hexagonal',  '/ui/ → infra leaks, direct I/O in UI'],
  ['container',  'modules with infra/ but no container.ts'],
  ['AUTH-BYPASS','apps/api decoding JWTs without verification'],
  ['secret',     'hardcoded secrets'],
  ['rls-anon',   'policies/grants TO anon'],
  ['rls',        'CREATE TABLE without RLS'],
  ['xss',        'dangerouslySetInnerHTML'],
  ['design:#fff','pure white'],
  ['design:fontSize', 'raw fontSize px'],
  ['design:var-fallback', 'var() fallbacks'],
  ['design:emoji', 'emoji in UI'],
  ['ui-reuse',   '@rolvium/ui reuse'],
  ['i18n',       'es/en key parity'],
];
const hardG = group(hard), warnG = group(warn);
for (const [check, label] of SECTIONS) {
  const h = (hardG[check] ?? []).length, w = (warnG[check] ?? []).length;
  const mark = h ? `${C.red}✗` : w ? `${C.yel}!` : `${C.grn}✓`;
  console.log(`${mark}${C.x} ${check.padEnd(20)} ${C.dim}${label} — ${h} hard, ${w} warn${C.x}`);
}
console.log('');

function printGroup(title, color, obj) {
  for (const [check, items] of Object.entries(obj)) {
    console.log(`${color}${title} · ${check}${C.x} ${C.dim}(${items.length})${C.x}`);
    for (const it of items.slice(0, 20)) {
      console.log(`  ${it.file}${it.line ? ':' + it.line : ''}  ${C.dim}${it.msg}${C.x}`);
    }
    if (items.length > 20) console.log(`  ${C.dim}… and ${items.length - 20} more${C.x}`);
    console.log('');
  }
}

if (hard.length) printGroup('HARD', C.red, hardG);
if (warn.length) printGroup('warn', C.yel, warnG);

console.log(`${C.dim}design totals — #fff:${dPureWhite} fontSize-px:${dFontPx} var-fallback:${dFallback} emoji:${dEmoji}${C.x}`);

console.log(`\n${C.b}Summary:${C.x} ${hard.length ? C.red : C.grn}${hard.length} hard${C.x} · ${C.yel}${warn.length} warn${C.x}`);
if (hard.length) {
  console.log(`${C.red}${C.b}✗ Hard violations present — fix before merge.${C.x}${STRICT ? '' : ` ${C.dim}(pass --strict to fail the process)${C.x}`}\n`);
  process.exit(STRICT ? 1 : 0);
} else {
  console.log(`${C.grn}✓ No hard violations.${C.x} ${C.dim}Warnings are drift to review, not blockers.${C.x}\n`);
  process.exit(0);
}
