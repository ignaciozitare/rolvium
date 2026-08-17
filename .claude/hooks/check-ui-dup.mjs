#!/usr/bin/env node
// PostToolUse hook (WARN-ONLY) — flags UI written in apps/web that looks like a
// locally reinvented component when @rolvium/ui already ships one.
//
// It NEVER blocks: any error or non-match exits 0 silently. On a match it prints
// a JSON warning that the user sees (systemMessage) and Claude sees
// (additionalContext), then still exits 0.
//
// Wired in .claude/settings.json under hooks.PostToolUse (matcher "Write|Edit").
// Manual test:
//   echo '{"tool_name":"Write","tool_input":{"file_path":"apps/web/src/modules/x/ui/Foo.tsx","content":"<div role=\"dialog\" style={{position:\"fixed\"}}>"}}' | node .claude/hooks/check-ui-dup.mjs

import fs from 'node:fs';

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch { process.exit(0); }

function main() {
  let payload;
  try { payload = JSON.parse(raw); } catch { return null; }

  const tool = payload.tool_name;
  if (tool !== 'Write' && tool !== 'Edit' && tool !== 'MultiEdit') return null;

  const input = payload.tool_input || {};
  const file = input.file_path || '';
  // Only care about frontend UI source, never tests.
  if (!/apps\/web\/src\//.test(file)) return null;
  if (!/\/ui\/|\/modules\//.test(file)) return null;
  if (!file.endsWith('.tsx')) return null;
  if (/\.(test|spec)\.tsx$/.test(file)) return null;

  // The freshly written content: Write -> content; Edit -> new_string;
  // MultiEdit -> concat of edits' new_string.
  let code = '';
  if (typeof input.content === 'string') code = input.content;
  else if (typeof input.new_string === 'string') code = input.new_string;
  else if (Array.isArray(input.edits)) code = input.edits.map((e) => e && e.new_string || '').join('\n');
  if (!code) return null;

  const importsUi = (name) =>
    new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]@rolvium/ui['"]`).test(code);

  const hits = [];

  // Local modal / overlay — the measured #1 offender.
  const looksLikeDialog =
    /role\s*=\s*['"]dialog['"]/.test(code) ||
    (/position\s*:\s*['"]fixed['"]/.test(code) && /z-?index|zIndex/i.test(code) && /onClose|backdrop|overlay|modal/i.test(code));
  if (looksLikeDialog && !importsUi('Modal') && !importsUi('ConfirmModal')) {
    hits.push('un overlay/diálogo local → @rolvium/ui ya tiene `Modal` y `ConfirmModal`');
  }

  // Local button with inline styles.
  if (/<button[\s>][^]*?style\s*=/.test(code) && !importsUi('Btn')) {
    hits.push('un <button> con estilos inline → @rolvium/ui ya tiene `Btn`');
  }

  if (!hits.length) return null;

  return `⚠️ Reutilización de UI — en ${file} parece que hay:\n` +
    hits.map((h) => `  · ${h}`).join('\n') +
    `\nLeé packages/ui/CATALOG.md y confirmá REUSE/EXTEND/NEW. Corré \`npm run audit\` para ver el conteo.`;
}

let message = null;
try { message = main(); } catch { message = null; }

if (message) {
  process.stdout.write(JSON.stringify({
    systemMessage: message,
    hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: message },
  }));
}
process.exit(0);
