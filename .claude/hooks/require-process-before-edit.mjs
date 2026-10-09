#!/usr/bin/env node
// PreToolUse hook — the process order, enforced at the first edit of product code.
//
// WHY THIS EXISTS. Commissioned by the owner on 2026-10-02, in his words: «quiero
// que no te puedas saltar nada a menos que te lo pida yo, luego cuando llegue el
// momento de sacar el spec para reconstruir esto no funcionará». That day a bug-fix
// session ran every HOOKED step (change-safety, QA) and skipped every step left to
// judgement: the Spec agent, the Design agent (a visible ✕ changed before the .pen),
// the ui-reuse and design-system skills, and the Deploy agent. Same pattern measured
// on 2026-07-29. Specs that are not kept in step with the code cannot rebuild it.
//
// WHAT IT GATES.
//   · Product code (apps/web/src, apps/api/src, packages/*/src|locales, migrations)
//     → the `spec` skill must have run in this session. OIH is excluded: its spec is
//       the external EKB, with its own gate (require-oih-spec.mjs).
//   · Anything the user sees (.tsx/.css under apps/web/src, packages/ui, OIH screens)
//     → `ui-reuse`, `design-system` AND `design` must have run. The Design agent
//       itself decides when a fix changes nothing visible; skipping it is not the
//       agent's call.
// Like the other gates it fires until the step has run, then never again this
// session, and it FAILS OPEN on anything unreadable.
//
// WHO IS GATED. The main thread, and every subagent except `review` and `qa` —
// a general-purpose subagent writing product code is Dev work, judged against the
// session's transcript (lib/session.mjs → caller). Files inside a Claude Code
// worktree (.claude/worktrees/<name>/) are classified like the same file at the root.
// NOT covered: edits made through Bash (sed -i, redirections, scripts). The merge
// gate is the backstop for those — it judges what reaches main, however written.
//
// HOW THE OWNER SKIPS A STEP: he writes «saltar spec» or «saltar diseño» in the chat
// (only text he types counts — see lib/session.mjs). Escape hatch for emergencies:
// <PROYECTO>_SKIP_PROCESS_GATES=1 in the environment.

import {
  readStdin, caller, sessionEntries, skillUsed, bashRan, ownerSkipped,
  norm, isExempt, isOih, isCode, isUi, loadConfig,
} from './lib/session.mjs';

const allow = () => process.exit(0);
// Escape del dueño: cualquier variable <PROYECTO>_SKIP_PROCESS_GATES=1 (HARNESS_, WORKSUITE_, ROLVIUM_…).
const envFlag = (name) => Object.entries(process.env).some(([k, v]) => v === '1' && new RegExp(`^[A-Z0-9]+_${name}$`).test(k));
if (envFlag('SKIP_PROCESS_GATES')) allow();

let input;
try {
  input = JSON.parse(await readStdin());
} catch {
  allow();
}
if (!['Write', 'Edit', 'MultiEdit'].includes(input?.tool_name || '')) allow();
// The review and qa subagents are the process. Any other subagent is judged
// against the session's transcript — delegating an edit skips nothing.
const who = caller(input);
if (who.processAgent) allow();

const target = String(input?.tool_input?.file_path || '');
const fp = norm(target); // repo-relative; inside a .claude/worktrees/<name>/ checkout too
if (fp === '' || isExempt(fp)) allow();

const needsSpec = isCode(fp) && !isOih(fp);
const needsUi = isUi(fp);
if (!needsSpec && !needsUi) allow();

const entries = sessionEntries(input, who);
if (!entries) {
  process.stderr.write('[process-gate] WARNING: could not read the session transcript; proceeding.\n');
  allow();
}

const missing = [];
if (needsSpec && !skillUsed(entries, 'spec') && !ownerSkipped(entries, 'spec')) missing.push('spec');
if (needsUi && !ownerSkipped(entries, 'diseno')) {
  for (const s of ['ui-reuse', 'design-system', 'design']) if (!skillUsed(entries, s)) missing.push(s);
  // The design is ported from its EXACT values, never by eye (owner, 2026-10-05). Until
  // 2026-10-09 that was a written rule only — and written rules get skipped. The floor:
  // the export of the approved frames was dumped with the tool in this session.
  if (loadConfig().penExport && !bashRan(entries, 'pen-css-tree')) missing.push('pen-export');
}
if (!missing.length) allow();

const why = {
  spec: 'Spec Agent — the spec must say what this change does BEFORE the code does it; the specs are what the product gets rebuilt from.',
  'ui-reuse': 'ui-reuse — check @worksuite/ui before writing any visual element (REUSE / EXTEND / NEW).',
  'design-system': 'design-system — Carbon Logic tokens, light + dark.',
  design: 'Design Agent — the .pen first, approved by the owner with screenshots; it also decides when a fix changes nothing visible.',
  'pen-export': 'Exact values from the .pen — export the approved frame(s) to html-css with the pencil MCP and dump them with `python3 .claude/tools/pen-css-tree.py <file> <id>` (Bash). Port those values; never copy a screenshot by eye.',
};
const msg = [
  '⛔ PROCESS GATE — blocked.',
  '',
  'You are about to modify:',
  `  ${target}`,
  '',
  'Steps of the project order that have NOT run in this session:',
  ...missing.map((s) => `  · ${why[s]}`),
  '',
  `Run them now${missing.some((s) => s !== 'pen-export') ? ` (Skill tool: ${missing.filter((s) => s !== 'pen-export').map((s) => `"${s}"`).join(', ')})` : ''}, then retry this edit.`,
  'Order: Spec → DBA → Scaffold → Design → Dev → Review → QA → Deploy (CLAUDE.md).',
  '',
  'Only the OWNER can skip a step, by writing «saltar spec» / «saltar diseño» in the chat.',
  'Do not ask him to skip it to save time: tell him what the step is for.',
].join('\n');
process.stderr.write(msg + '\n');
process.exit(2);
