#!/usr/bin/env node
// PreToolUse hook — change-safety gate.
//
// WHY THIS EXISTS. The pattern measured in the sibling project WorkSuite on
// 2026-07-29: everything enforced by a hook was followed 100% of the time (a
// read-gate that blocks the Write cannot be skipped); everything left to the
// agent's judgement was skipped for
// whole sessions — including `change-safety`, whose entire job is to stop
// opportunistic edits outside the scope the user asked for. A reminder in a file is
// the same honour system that already failed. This is not.
//
// ── THE DESIGN CONSTRAINT THE OWNER SET ─────────────────────────────────────
// "Make the hook, but it must not block things I explicitly tell you to do."
//
// So this fires ONCE PER SESSION and then goes silent forever. The failure it
// targets is skipping the skill ENTIRELY, not skipping it on edit #47 — so one
// gate at the start is the whole fix. After the skill is loaded, no edit is ever
// blocked again, which means the hook can never stand between the owner and a
// specific instruction. The cost is a single tool call, once.
//
// It also FAILS OPEN everywhere it is unsure: a bad payload, a missing transcript
// or a parse error allows the edit and prints a warning. A harness change must
// never be able to hard-block all work in the repo.
//
// Escape hatch (for the owner, not for the agent): set
//   ROLVIUM_SKIP_CHANGE_SAFETY=1
// in the environment to disable this gate completely.

import { readFileSync, existsSync } from 'node:fs';

const SKILL = 'change-safety';
const allow = () => process.exit(0);

if (process.env.ROLVIUM_SKIP_CHANGE_SAFETY === '1') allow();

function readStdin(stream) {
  return new Promise((resolve) => {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', (c) => (data += c));
    stream.on('end', () => resolve(data));
    stream.on('error', () => resolve(''));
  });
}

const raw = await readStdin(process.stdin);
let input;
try {
  input = JSON.parse(raw);
} catch {
  allow(); // malformed payload → never block real work
}

const tool = input?.tool_name || '';
if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) allow();

const fp = String(input?.tool_input?.file_path || '').replace(/\\/g, '/');

// Writing down understanding must NEVER be blocked. Docs, specs, the work state and
// the harness itself stay open, as do scratch files and anything generated.
const EXEMPT = [
  /\.mdx?$/i, // any markdown: docs, specs, ADR proposals, WORK_STATE
  /(?:^|\/)specs\//,
  /(?:^|\/)\.claude\//, // the harness itself, including this hook
  /(?:^|\/)node_modules\//,
  /(?:^|\/)(?:dist|build|coverage)\//,
  /(?:^|\/)package-lock\.json$/,
  /\/scratchpad\//,
  /^\/(?:tmp|private\/tmp|var\/folders)\//,
];
if (fp === '' || EXEMPT.some((re) => re.test(fp))) allow();

// Was the skill loaded in this session?
const transcriptPath = input?.transcript_path;
if (!transcriptPath || !existsSync(transcriptPath)) {
  process.stderr.write(
    '[change-safety-gate] WARNING: could not read the session transcript to verify the ' +
      'change-safety skill was loaded. Proceeding — but load it before making scope decisions.\n'
  );
  allow();
}

let loaded = false;
try {
  const lines = readFileSync(transcriptPath, 'utf8').split('\n');
  outer: for (const line of lines) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const blocks = entry?.message?.content ?? entry?.content;
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) {
      // The Skill tool call is the signal. A `/change-safety` typed by the user
      // arrives the same way, so an explicit invocation counts too.
      if (b?.type === 'tool_use' && b?.name === 'Skill' && String(b?.input?.skill || '') === SKILL) {
        loaded = true;
        break outer;
      }
    }
  }
} catch {
  process.stderr.write('[change-safety-gate] WARNING: transcript parse failed; proceeding.\n');
  allow();
}

if (loaded) allow();

const msg = [
  '⛔ CHANGE-SAFETY GATE — blocked (this fires ONCE per session, then never again).',
  '',
  `You are about to modify:`,
  `  ${fp}`,
  'without having loaded the `change-safety` skill in this session.',
  '',
  'That skill is the scope discipline: change only what was asked, treat existing',
  'code as intentional, no opportunistic cleanup, no migrating unrelated consumers,',
  'and stop at the safe boundary if the task reveals a bigger problem.',
  '',
  'Load it now — Skill tool, skill: "change-safety" — then retry this edit.',
  'After that, nothing else in this session is gated: this exists to stop the skill',
  'being skipped entirely, not to slow down work the user explicitly asked for.',
  '',
  '(Owner escape hatch: ROLVIUM_SKIP_CHANGE_SAFETY=1 disables this gate.)',
].join('\n');
process.stderr.write(msg + '\n');
process.exit(2);
