#!/usr/bin/env node
// PreToolUse hook — the end of the process order, enforced on the merge to main.
//
// WHY THIS EXISTS. Same commission as require-process-before-edit.mjs (owner,
// 2026-10-02): nothing is skipped unless he asks — and the specs must stay good
// enough to rebuild the product from. The QA gate (require-qa-before-merge.mjs)
// already holds QA; this adds the three steps around it that were still on honour:
//
//   · REVIEW  — the `review` subagent (or the /review skill) ran in this session.
//   · DEPLOY  — the `deploy` skill ran: it is the agent that owns the merge.
//   · SPEC IN STEP — if the branch changes a module's code, that module's spec
//     folder changed in the SAME branch (specs/modules/<m>/, auth → specs/core/auth/;
//     code outside a module needs some change under specs/). This is the mechanical
//     floor of "the spec can rebuild this": it cannot judge the words, the review and
//     QA agents do that, but it makes a code-only merge impossible.
//
// Only when what goes to main CONTAINS product code. A docs-only or version-only
// push is untouched. OIH code is excluded (its spec is the external EKB). Tests do
// not count as code here.
//
// WHAT COUNTS AS GOING TO MAIN (lib/session.mjs → mainLandings): `git merge <ref>`
// with main checked out (or after `git checkout main` in the same command), any
// `git push` whose destination is main (`main`, `HEAD:main`, `feat:main`, `--all`,
// or no refspec while on main — `git -C`, `bash -c`, subdirectories and worktrees
// included), and `gh pr merge` into main. NOT gated: merging main INTO a feature
// branch, `git merge --abort|--continue|--quit`, `git merge-base`, pushing any
// other branch.
//
// FAILING OPEN. An unreadable payload or transcript lets the command through. When
// git cannot list what would land, the review and deploy checks still apply (a
// merge to main without them is exactly what this gate is for) and only the spec
// check is skipped, with a warning.
//
//   · BACKLOG IN STEP — if the module has a specs/modules/<m>/BACKLOG.md, it (or its
//     BACKLOG_DONE.md) changed in the same branch. Modules with no backlog file yet
//     are not gated.
//
//   · SECURITY — if the merge carries API code, a migration or authentication code,
//     the `security` subagent ran in this session.
//
// HOW THE OWNER SKIPS A STEP: «saltar review», «saltar deploy», «saltar spec», «saltar backlog» or «saltar seguridad» in
// the chat. Emergency escape hatch: <PROYECTO>_SKIP_PROCESS_GATES=1.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  readStdin, caller, sessionEntries, skillUsed, agentUsed, ownerSkipped,
  isCode, isOih, isTest, mainLandings, landingFiles, repoRoot, specFolderFor, backlogFilesIn, isSecuritySensitive,
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
if (input?.tool_name !== 'Bash') allow();
const who = caller(input);
if (who.processAgent) allow(); // review / qa: the process itself

const command = String(input?.tool_input?.command || '');
const cwd = input?.cwd || process.cwd();

const landings = mainLandings(command, cwd);
if (!landings.length) allow(); // nothing in this command reaches main

let files = [];
for (const landing of landings) {
  const f = landingFiles(landing);
  if (f === null) {
    files = null;
    break;
  }
  files.push(...f);
}
const code = files ? [...new Set(files)].filter((f) => isCode(f) && !isOih(f) && !isTest(f)) : null;
if (code && code.length === 0) allow(); // docs, specs, versions: nothing to gate

const entries = sessionEntries(input, who);
if (!entries) {
  process.stderr.write('[process-gate] WARNING: could not read the session transcript; proceeding.\n');
  allow();
}

const problems = [];
if (!(agentUsed(entries, 'review') || skillUsed(entries, 'review')) && !ownerSkipped(entries, 'review')) {
  problems.push('· REVIEW — the `review` subagent has not run in this session (Agent tool, subagent_type: "review").');
}
if (!skillUsed(entries, 'deploy') && !ownerSkipped(entries, 'deploy')) {
  problems.push('· DEPLOY — the Deploy agent has not run in this session (Skill tool: "deploy"); it owns the merge.');
}
// SECURITY (2026-10-09) — API code, a migration or authentication code going to main
// needs the `security` subagent: it is the only step that looks at how secrets are
// stored and who can reach them. When git cannot list the files, it is required too.
if ((!code || code.some(isSecuritySensitive)) && !(agentUsed(entries, 'security') || skillUsed(entries, 'security')) && !ownerSkipped(entries, 'seguridad')) {
  problems.push('· SECURITY — this merge carries API, database or authentication code and the `security` subagent has not run in this session (Agent tool, subagent_type: "security").');
}
if (code && !ownerSkipped(entries, 'spec')) {
  const root = repoRoot(landings[0].dir);
  const specs = files.filter((f) => /^specs\//.test(f) && !/^specs\/external\//.test(f));
  const needed = new Set();
  for (const f of code) {
    const folder = specFolderFor(f);
    needed.add(folder && existsSync(join(root, folder)) ? folder : 'specs/');
  }
  const stale = [...needed].filter((folder) => !specs.some((s) => s.startsWith(folder)));
  if (stale.length) {
    problems.push(
      '· SPEC IN STEP — this merge changes product code but not its spec:',
      ...stale.map((folder) => `    ${folder === 'specs/' ? 'no file under specs/' : folder} (nothing changed in this branch)`),
      '  Update the spec(s) in this branch so they describe what the code now does.',
    );
  }
}
// BACKLOG IN STEP (2026-10-09) — a module that HAS a backlog (specs/modules/<m>/BACKLOG.md,
// kept by the PO Agent) must see it move with its code: the item goes 🔄 when the spec
// is confirmed, so a branch that never touched it is work the backlog does not know
// about. Modules without a BACKLOG.md yet are not gated — migrating is the owner's call.
if (code && !ownerSkipped(entries, 'backlog')) {
  const root = repoRoot(landings[0].dir);
  const folders = new Set(code.map(specFolderFor).filter(Boolean));
  const stale = [...folders].filter(
    (folder) => existsSync(join(root, folder, 'BACKLOG.md')) && !backlogFilesIn(folder).some((b) => files.includes(b)),
  );
  if (stale.length) {
    problems.push(
      '· BACKLOG IN STEP — this merge changes a module\'s code but not its backlog:',
      ...stale.map((folder) => `    ${folder}BACKLOG.md (nothing changed in this branch)`),
      '  Run the PO agent (Skill tool: "po", mode Enlazar) so the item this work answers is 🔄.',
    );
  }
}
if (!code) {
  process.stderr.write('[process-gate] WARNING: could not list the files going to main; spec check skipped.\n');
}
if (!problems.length) allow();

const msg = [
  '⛔ PROCESS GATE — merge to main blocked.',
  '',
  `  ${command.split('\n')[0].slice(0, 160)}`,
  '',
  ...problems,
  '',
  'Order: Spec → DBA → Scaffold → Design → Dev → Review → QA → Deploy (CLAUDE.md).',
  'Only the OWNER can skip a step, by writing «saltar review» / «saltar deploy» / «saltar spec» / «saltar backlog» / «saltar seguridad»',
  'in the chat. Do not ask him to skip it to save time: tell him what the step is for.',
].join('\n');
process.stderr.write(msg + '\n');
process.exit(2);
