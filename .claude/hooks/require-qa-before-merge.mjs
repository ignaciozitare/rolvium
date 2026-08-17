#!/usr/bin/env node
// PreToolUse hook — QA gate on the MERGE, not on the edit.
//
// WHY THIS EXISTS. Commissioned by the owner in a previous project on
// 2026-08-10, in his words: «muy mal lo de qa, no te los puedes saltar porque sí.
// Ponlo en el hook igual que el del diseño». That morning a fix branch was merged
// to `main` with the review subagent passed and the preview green — and QA skipped entirely,
// on my own judgement, because he had not typed the words "ready to merge". Two of
// the three things he then saw on screen were still broken. CLAUDE.md already said
// QA runs before a merge; leaving it to the agent's judgement is the same honour
// system that has failed before. This is not.
//
// WHAT IT GATES. Only the act that puts code on `main`: `git merge` and `git push`
// aimed at main. Every other command runs untouched — committing, branching,
// pushing a feature branch, running tests, deploying a preview. The gate is on the
// one irreversible step, so it can never stand between the owner and ordinary work.
//
// IT FIRES ONCE PER SESSION, exactly like the change-safety gate: once QA has run,
// the rest of the session is free. The failure it targets is skipping QA entirely.
//
// It FAILS OPEN everywhere it is unsure — a bad payload, a missing transcript, a
// parse error — and prints a warning instead. A harness change must never be able
// to hard-block a merge in an emergency.
//
// Owner escape hatch: ROLVIUM_SKIP_QA=1.

import { readFileSync, existsSync } from 'node:fs';

const allow = () => process.exit(0);

if (process.env.ROLVIUM_SKIP_QA === '1') allow();

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

if (input?.tool_name !== 'Bash') allow();

const command = String(input?.tool_input?.command || '');
if (command.trim() === '') allow();

// ── Is this command putting code on main? ────────────────────────────────────
//
// QUOTED TEXT IS STRIPPED FIRST, and that is not a nicety: the very first commit
// this hook saw was `git commit -m "…gate that blocks git merge…"`, and the words
// inside the MESSAGE matched. A commit message is prose, not a command. So single
// quotes, double quotes and heredoc bodies are blanked before any matching —
// anything left is the command line itself.
const executable = command
  .replace(/<<-?'?(\w+)'?[\s\S]*?^\1$/gm, ' ') // heredoc bodies
  .replace(/'[^']*'/g, " '' ")
  .replace(/"[^"]*"/g, ' "" ');

// Deliberately narrow. Two shapes, and nothing else:
//   · `git merge …`      — run while ON main, which is how this repo merges.
//   · `git push … main`  — pushing the main branch, however it is spelled.
// A push of a feature branch, a commit, a rebase or a checkout never matches, so
// the everyday loop is untouched.
const MERGE = /\bgit\s+merge\b/;
const PUSH_MAIN = /\bgit\s+push\b[^\n;&|]*\bmain\b/;
// `git push` with no refspec pushes the CURRENT branch — main only when we are on
// it. Cheap to read from the payload's cwd rather than shelling out.
const BARE_PUSH = /\bgit\s+push\b(?![^\n;&|]*\S)/;

let targetsMain = MERGE.test(executable) || PUSH_MAIN.test(executable);
if (!targetsMain && BARE_PUSH.test(executable)) {
  try {
    const head = readFileSync(`${input?.cwd || process.cwd()}/.git/HEAD`, 'utf8').trim();
    targetsMain = head === 'ref: refs/heads/main';
  } catch {
    // Unknown branch → do not block. Failing open is the rule.
    allow();
  }
}
if (!targetsMain) allow();

// ── Did QA run in this session? ──────────────────────────────────────────────
const transcriptPath = input?.transcript_path;
if (!transcriptPath || !existsSync(transcriptPath)) {
  process.stderr.write(
    '[qa-gate] WARNING: could not read the session transcript to verify the QA agent ran. ' +
      'Proceeding — but run QA before merging.\n'
  );
  allow();
}

let ran = false;
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
      if (b?.type !== 'tool_use') continue;
      // The QA subagent, however it was reached: the Agent tool with the `qa`
      // subagent type, or the `/qa` skill the owner can invoke by hand.
      const isQaAgent = b?.name === 'Agent' && String(b?.input?.subagent_type || '') === 'qa';
      const isQaSkill = b?.name === 'Skill' && String(b?.input?.skill || '') === 'qa';
      if (isQaAgent || isQaSkill) {
        ran = true;
        break outer;
      }
    }
  }
} catch {
  process.stderr.write('[qa-gate] WARNING: transcript parse failed; proceeding.\n');
  allow();
}

if (ran) allow();

const msg = [
  '⛔ QA GATE — blocked (this fires ONCE per session, then never again).',
  '',
  'You are about to put code on `main`:',
  `  ${command.split('\n')[0].slice(0, 160)}`,
  'without having run the QA agent in this session.',
  '',
  'QA is the last automated gate before main: the full pre-merge audit — review,',
  'spec compliance, the whole test suite, architecture and security, Supabase',
  'advisors, i18n parity, docs and both builds. A passing review and a green',
  'preview are NOT a substitute; that combination shipped two visible defects to',
  'the owner on 2026-08-10 (in a previous project), which is why this gate exists.',
  '',
  'Run it now — Agent tool, subagent_type: "qa" (the orchestrator `/qa` skill asks',
  'the owner the block/warn and light/dark questions first) — then retry the merge.',
  '',
  '(Owner escape hatch: ROLVIUM_SKIP_QA=1 disables this gate.)',
].join('\n');
process.stderr.write(msg + '\n');
process.exit(2);
