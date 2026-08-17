#!/usr/bin/env node
/**
 * Build the Fastify-on-Vercel handler using Vercel's Build Output API v3.
 *
 * Why: workspace packages (@rolvium/*) export raw TypeScript via
 * `main: ./src/index.ts`, which the legacy @vercel/node builder cannot resolve.
 * Pre-bundling with esbuild and writing the Build Output layout ourselves
 * sidesteps it: Vercel just serves `.vercel/output/`.
 *
 *   .vercel/output/functions/api/_handler.func/index.mjs   ← esbuild bundle
 *   .vercel/output/functions/api/_handler.func/.vc-config.json
 *   .vercel/output/config.json                             ← routes
 */
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, 'handler-entry.ts');
const outRoot = resolve(__dirname, '.vercel/output');
const funcDir = resolve(outRoot, 'functions/api/_handler.func');
const outfile = resolve(funcDir, 'index.mjs');

await mkdir(funcDir, { recursive: true });

await build({
  entryPoints: [entry],
  outfile,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  sourcemap: false,
  logLevel: 'info',
  resolveExtensions: ['.ts', '.tsx', '.mjs', '.js', '.cjs', '.json'],
  loader: { '.ts': 'ts' },
});

await writeFile(
  resolve(funcDir, '.vc-config.json'),
  JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: true, maxDuration: 30, memory: 512 }, null, 2),
);

await writeFile(
  resolve(outRoot, 'config.json'),
  JSON.stringify({
    version: 3,
    routes: [
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/api/_handler' },
    ],
  }, null, 2),
);

console.log(`✓ Bundled API → ${outfile}`);
