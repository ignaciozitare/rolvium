// Shared helpers for the process gates (require-process-before-edit / -merge).
//
// The gates read the session transcript to answer two questions: "did this step
// run in this session?" and "did the OWNER explicitly ask to skip it?". Both are
// answered from the transcript, never from anything the agent can type into a
// command, so the agent cannot talk its way past a gate.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, resolve as resolvePath } from 'node:path';
import { homedir } from 'node:os';

export function readStdin(stream = process.stdin) {
  return new Promise((resolve) => {
    let data = '';
    stream.setEncoding('utf8');
    stream.on('data', (c) => (data += c));
    stream.on('end', () => resolve(data));
    stream.on('error', () => resolve(''));
  });
}

/** Transcript entries, or null when it cannot be read (callers fail open). */
export function loadTranscript(path) {
  if (!path || !existsSync(path)) return null;
  try {
    const out = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        /* a torn line is not a reason to block */
      }
    }
    return out;
  } catch {
    return null;
  }
}

// ── Who is calling ────────────────────────────────────────────────────────────

/** The subagents that ARE the process: they fix what the gates' steps found. */
const PROCESS_AGENTS = new Set(['review', 'qa']);

/**
 * Where the tool call comes from (code.claude.com/docs/en/hooks):
 *  · `agent_id` is present ONLY inside a subagent. `agent_type` alone proves
 *    nothing — it is also set on the MAIN thread of a session started with
 *    `--agent`, and trusting it would switch every gate off for that session.
 *  · Inside a subagent `transcript_path` is the subagent's OWN transcript,
 *    <project>/<session>/subagents/agent-<id>.jsonl, which holds none of the
 *    session's steps; the session's is <project>/<session>.jsonl.
 * Only `review` and `qa` pass untouched. Any other subagent doing Dev work is
 * judged against the session, so delegating an edit is not a way around a step.
 */
export function caller(input) {
  const tp = String(input?.transcript_path || '');
  const m = tp.match(/^(.*)\/subagents\/agent-[^/]+\.jsonl$/);
  if (!input?.agent_id && !m) return { inSubagent: false, processAgent: false, parentTranscript: null };
  let type = input?.agent_type ? String(input.agent_type) : '';
  if (!type && m) {
    try {
      type = String(JSON.parse(readFileSync(tp.replace(/\.jsonl$/, '.meta.json'), 'utf8'))?.agentType || '');
    } catch {
      /* unknown type: judged like any other subagent */
    }
  }
  return { inSubagent: true, processAgent: PROCESS_AGENTS.has(type), parentTranscript: m ? `${m[1]}.jsonl` : null };
}

/**
 * The entries a gate judges on: the session transcript, plus — inside a subagent —
 * the subagent's own. Null when the session transcript cannot be read (fail open).
 */
export function sessionEntries(input, who = caller(input)) {
  if (!who.inSubagent) return loadTranscript(input?.transcript_path);
  const session = loadTranscript(who.parentTranscript);
  if (!session) return null;
  return session.concat(loadTranscript(input?.transcript_path) || []);
}

// ── What ran, what the owner said ─────────────────────────────────────────────

function toolUses(entries) {
  const uses = [];
  for (const e of entries) {
    const blocks = e?.message?.content ?? e?.content;
    if (!Array.isArray(blocks)) continue;
    for (const b of blocks) if (b?.type === 'tool_use') uses.push(b);
  }
  return uses;
}

const textOf = (c) =>
  typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text || '').join('\n') : '';

/**
 * The skill ran: a Skill tool call, or the owner typing `/name` — that loads the
 * skill WITHOUT a tool call and is recorded as a prompt entry that starts with
 * `<command-name>/name</command-name>` (origin-less, not meta, not a sidechain).
 */
export function skillUsed(entries, name) {
  if (toolUses(entries).some((b) => b?.name === 'Skill' && String(b?.input?.skill || '') === name)) return true;
  const tag = `<command-name>/${name}</command-name>`;
  return entries.some((e) => {
    if (e?.type !== 'user' || e?.isMeta || e?.isSidechain) return false;
    if (e?.origin && e.origin.kind !== 'human') return false;
    const c = e?.message?.content;
    if (Array.isArray(c) && c.some((b) => b?.type === 'tool_result')) return false;
    const t = textOf(c).trimStart();
    return t.startsWith('<command-') && t.includes(tag);
  });
}

/**
 * A Bash command containing `needle` ran in this session (e.g. the `.pen` export
 * dump, `pen-css-tree`). Only the command line counts — prose never does.
 */
export function bashRan(entries, needle) {
  return toolUses(entries).some((b) => b?.name === 'Bash' && String(b?.input?.command || '').includes(needle));
}

/** The Agent tool launched with this subagent type. */
export function agentUsed(entries, type) {
  return toolUses(entries).some((b) => b?.name === 'Agent' && String(b?.input?.subagent_type || '') === type);
}

/**
 * Text the OWNER typed, and only that. The harness marks it `origin.kind: 'human'`
 * in two places: a prompt entry, and a `queued_command` attachment — what he types
 * while the agent is busy. Subagent hand-backs (`peer`, meta), task notifications,
 * skill bodies, subagent prompts (sidechain, no origin) and AskUserQuestion answers
 * (tool results) never carry it. Injected context (`<system-reminder>`, which is
 * how CLAUDE.md reaches the model) and pasted blocks are cut out first: CLAUDE.md
 * documents the skip phrases, and quoting the docs must never count as asking.
 */
export function ownerTexts(entries) {
  const texts = [];
  for (const e of entries) {
    let c;
    if (e?.type === 'user' && !e?.isMeta && !e?.isSidechain && e?.origin?.kind === 'human') {
      c = e?.message?.content;
      if (Array.isArray(c) && c.some((b) => b?.type === 'tool_result')) continue;
    } else if (e?.type === 'attachment' && e?.attachment?.type === 'queued_command' && e?.attachment?.origin?.kind === 'human') {
      c = e.attachment.prompt;
    } else continue;
    const t = textOf(c)
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ' ')
      .replace(/<pasted_content[\s\S]*?<\/pasted_content[^>]*>/g, ' ');
    if (t.trim()) texts.push(t);
  }
  return texts;
}

/** What the owner can write in the chat to skip a gate for the rest of the session. */
export const SKIP_WORDS = {
  spec: ['spec'],
  diseno: ['diseno', 'design'],
  review: ['review', 'revision'],
  deploy: ['deploy', 'despliegue'],
  backlog: ['backlog'],
  seguridad: ['seguridad', 'security'],
};

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Before «saltar» in the same clause, any of these turns the phrase into something
// other than a request: «no te podés saltar el diseño», «nunca saltar spec»,
// «si querés saltar la review, avisame», «porque saltar spec rompe todo».
const NOT_A_REQUEST = /\b(?:no|nunca|jamas|ni|sin|tampoco|si|cuando|porque|por que|para que)\b/;

/**
 * True when the owner asked to skip this gate: «saltar <palabra>», also as a list
 * («saltar spec y diseño», «saltar la review, el deploy»). A question («¿por qué
 * volviste a saltar el diseño?») or a negated / conditional clause is not a request
 * — a complaint about a skipped step must never open the gate it complains about.
 */
export function ownerSkipped(entries, gate) {
  const words = SKIP_WORDS[gate] || [];
  const item = `(?:(?:el|la|los|las)\\s+)?(?:${Object.values(SKIP_WORDS).flat().join('|')})\\b`;
  const re = new RegExp(`\\bsaltar\\s+(${item}(?:\\s*(?:,|\\by\\b)\\s*${item})*)`, 'g');
  for (const text of ownerTexts(entries)) {
    for (const sentence of fold(text).split(/(?<=[.!?;\n])|(?=[¿¡])/)) {
      if (sentence.includes('?') || sentence.includes('¿')) continue;
      for (const m of sentence.matchAll(re)) {
        if (NOT_A_REQUEST.test(sentence.slice(0, m.index).split(/[,:]/).pop())) continue;
        const listed = m[1].split(/\s*(?:,|\by\b)\s*/).map((w) => w.replace(/^(?:el|la|los|las)\s+/, '').trim());
        if (listed.some((w) => words.includes(w))) return true;
      }
    }
  }
  return false;
}

// ── Which files are which ─────────────────────────────────────────────────────

/**
 * Repo-relative spelling where it can be had. A Claude Code worktree
 * (<repo>/.claude/worktrees/<name>/…) is a full checkout: its files are classified
 * as if they sat at the root — otherwise the `.claude/` exemption would wave
 * through every edit made inside one.
 */
export function norm(p) {
  let s = String(p || '').replace(/\\/g, '/');
  const wt = s.match(/^.*?\/\.claude\/worktrees\/[^/]+\/(.*)$/);
  if (wt) return wt[1];
  const root = String(process.env.CLAUDE_PROJECT_DIR || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (root && s.startsWith(`${root}/`)) s = s.slice(root.length + 1);
  return s;
}

/** Never gated: writing down understanding, the harness itself, generated output. */
export function isExempt(fp) {
  return [
    /\.mdx?$/i,
    /(?:^|\/)specs\//,
    /(?:^|\/)\.claude\//,
    /(?:^|\/)node_modules\//,
    /(?:^|\/)(?:dist|build|coverage)\//,
    /(?:^|\/)package-lock\.json$/,
    /\/scratchpad\//,
    /^\/(?:tmp|private\/tmp|var\/folders)\//,
  ].some((re) => re.test(fp));
}

// ── Project configuration ─────────────────────────────────────────────────────
//
// What is "product code", "a screen", "security-sensitive" and where a module's spec
// lives differs per project. It comes from `.claude/harness.config.json` in the
// project; anything missing falls back to the defaults below (the layout shared by
// the owner's monorepos: apps/web + apps/api + packages/* + supabase/migrations).
// Patterns are regular expressions matched from the start of a repo-relative path
// (or after any `/` when the path is absolute).

export const DEFAULT_CONFIG = {
  // Product code: what a rebuild from the specs has to be able to reproduce.
  code: ['apps/[^/]+/src/', 'packages/[^/]+/(?:src|locales)/', 'supabase/migrations/'],
  // What the user sees. A file is UI when it has one of `ext` and matches one of `paths`.
  ui: { ext: ['tsx', 'css'], paths: ['apps/web/src/', 'packages/ui/src/'] },
  // Code governed by an EXTERNAL spec (its own gate): excluded from the spec/backlog checks.
  externalSpec: [],
  // Code whose merge needs the security subagent.
  securitySensitive: ['apps/api/src/', 'supabase/migrations/', 'apps/web/src/modules/auth/', 'apps/web/src/shared/hooks/useAuth\\.tsx?$'],
  // Where the spec of a piece of code lives. First match wins; `$1` is the capture.
  specFolders: [
    { match: 'apps/web/src/modules/auth/', folder: 'specs/core/auth/' },
    { match: 'apps/web/src/modules/([^/]+)/', folder: 'specs/modules/$1/' },
  ],
  // Require the `.pen` export to be dumped (tools/pen-css-tree.py) before editing UI.
  penExport: false,
};

let cached;
export function loadConfig() {
  if (cached) return cached;
  const candidates = [
    process.env.HARNESS_CONFIG,
    process.env.CLAUDE_PROJECT_DIR && `${process.env.CLAUDE_PROJECT_DIR}/.claude/harness.config.json`,
    `${process.cwd()}/.claude/harness.config.json`,
  ].filter(Boolean);
  let user = {};
  for (const c of candidates) {
    try {
      user = JSON.parse(readFileSync(c, 'utf8'));
      break;
    } catch {
      /* missing or unreadable: defaults */
    }
  }
  cached = { ...DEFAULT_CONFIG, ...user, ui: { ...DEFAULT_CONFIG.ui, ...(user.ui || {}) } };
  return cached;
}
const rx = (pattern) => {
  try {
    return new RegExp(`(?:^|/)${pattern}`);
  } catch {
    return /$^/; // a broken pattern matches nothing — never blocks by accident
  }
};
const any = (patterns, fp) => (patterns || []).some((p) => rx(p).test(fp));

/** Governed by an external spec with its own gate (name kept for the callers). */
export function isOih(fp) {
  return any(loadConfig().externalSpec, fp);
}

/** Product code: what a rebuild from the specs has to be able to reproduce. */
export function isCode(fp) {
  return any(loadConfig().code, fp);
}

export function isTest(fp) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(fp) || /(?:^|\/)tests?\//.test(fp);
}

/** What the user sees: components and styles. */
export function isUi(fp) {
  if (isTest(fp)) return false;
  const { ext, paths } = loadConfig().ui;
  if (!new RegExp(`\\.(?:${ext.join('|')})$`).test(fp)) return false;
  return any(paths, fp);
}

/** Code whose merge needs the security subagent: the API, the database, authentication. */
export function isSecuritySensitive(fp) {
  return any(loadConfig().securitySensitive, fp);
}

/** The backlog files of a module's spec folder (PO Agent, commands/po.md). */
export const backlogFilesIn = (folder) => [`${folder}BACKLOG.md`, `${folder}BACKLOG_DONE.md`];

/** The spec folder a piece of code answers to, or null. */
export function specFolderFor(fp) {
  for (const { match, folder } of loadConfig().specFolders || []) {
    const m = fp.match(rx(match));
    if (m) return folder.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? '');
  }
  return null;
}

// ── Reading a Bash command ────────────────────────────────────────────────────

/**
 * The simple commands in a Bash line, as shell words: quotes resolved (a commit
 * MESSAGE is one word, never a command), heredoc bodies and redirections dropped,
 * split on && || ; | & ( ) ` and newlines.
 */
export function shellCommands(command) {
  const src = String(command || '').replace(/<<-?[ \t]*(['"]?)(\w+)\1[\s\S]*?^[ \t]*\2[ \t]*$/gm, ' ');
  const cmds = [[]];
  let word = null;
  let redirect = false;
  const end = () => {
    if (word !== null && !redirect) cmds[cmds.length - 1].push(word);
    if (word !== null) redirect = false;
    word = null;
  };
  const sep = () => {
    end();
    redirect = false;
    if (cmds[cmds.length - 1].length) cmds.push([]);
  };
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === "'") {
      const j = src.indexOf("'", i + 1);
      word = (word ?? '') + src.slice(i + 1, j < 0 ? src.length : j);
      i = j < 0 ? src.length : j;
    } else if (ch === '"') {
      let s = '';
      for (i++; i < src.length && src[i] !== '"'; i++) {
        if (src[i] === '\\' && i + 1 < src.length) i++;
        s += src[i];
      }
      word = (word ?? '') + s;
    } else if (ch === '\\') {
      if (src[i + 1] !== '\n') word = (word ?? '') + (src[i + 1] ?? '');
      i++;
    } else if (ch === '#' && word === null) {
      while (i < src.length && src[i] !== '\n') i++;
      sep();
    } else if (ch === '>' || ch === '<') {
      if (word !== null && /^\d+$/.test(word)) word = null; // the fd in 2>&1
      end();
      while ('<>&|'.includes(src[i + 1] ?? ' ')) i++;
      redirect = true; // the next word is the target, not an argument
    } else if (ch === '\n' || ';&|()`'.includes(ch)) {
      sep();
    } else if (/\s/.test(ch)) {
      end();
    } else {
      word = (word ?? '') + ch;
    }
  }
  end();
  return cmds.filter((c) => c.length);
}

const WRAPPERS = new Set(['env', 'command', 'exec', 'nohup', 'time', 'sudo', 'nice']);
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash']);
const GIT_GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env', '--super-prefix']);

/** Every git (and `gh pr merge`) call in the command, in order, with the `cd`s between them. */
export function gitCalls(command, depth = 0) {
  const out = [];
  for (const words of shellCommands(command)) {
    let i = 0;
    while (i < words.length && (/^[A-Za-z_]\w*=/.test(words[i]) || WRAPPERS.has(words[i]))) i++;
    const prog = basename(words[i] || '');
    if (prog === 'cd') {
      out.push({ cd: words[i + 1] ?? '~' });
    } else if (SHELLS.has(prog) && depth < 3) {
      const k = words.findIndex((w, j) => j > i && /^-[a-z]*c[a-z]*$/.test(w));
      if (k > 0 && words[k + 1]) out.push(...gitCalls(words[k + 1], depth + 1));
    } else if (prog === 'gh' && words[i + 1] === 'pr' && words[i + 2] === 'merge') {
      out.push({ gh: words.slice(i + 3) });
    } else if (prog === 'git') {
      const C = [];
      for (i++; i < words.length && words[i].startsWith('-'); i++) {
        if (words[i] === '-C') C.push(words[++i] ?? '.');
        else if (GIT_GLOBAL_WITH_VALUE.has(words[i])) i++;
      }
      if (i < words.length) out.push({ git: words[i], args: words.slice(i + 1), C });
    }
  }
  return out;
}

const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', timeout: 8000 });
  return r.status === 0 ? r.stdout : null;
};
const resolveDir = (base, d) => resolvePath(base, String(d).replace(/^~(?=\/|$)/, homedir()));

/** Branch checked out in `dir`: a name, null when detached, undefined when git cannot say. */
function checkedOut(dir) {
  const out = run('git', ['symbolic-ref', '-q', '--short', 'HEAD'], dir);
  if (out !== null) return out.trim();
  return run('git', ['rev-parse', '--git-dir'], dir) !== null ? null : undefined;
}

/** The branch `git checkout|switch …` moves to; undefined when it moves nothing (files). */
function checkoutTarget(sub, args) {
  if (args.includes('--')) return undefined;
  const create = sub === 'checkout' ? ['-b', '-B', '--orphan'] : ['-c', '-C', '--create', '--force-create', '--orphan'];
  for (let i = 0; i < args.length; i++) {
    if (create.includes(args[i])) return args[i + 1];
    if (args[i] === '--detach' || args[i] === '-d') return null;
    if (!args[i].startsWith('-') || args[i] === '-') return args[i];
  }
  return undefined;
}

const MERGE_WITH_VALUE = new Set(['-m', '-F', '--file', '-s', '--strategy', '-X', '--strategy-option', '--into-name']);
const PUSH_WITH_VALUE = new Set(['--repo', '-o', '--push-option', '--receive-pack', '--exec']);
const GH_MERGE_WITH_VALUE = new Set(['-t', '--subject', '-b', '--body', '-F', '--body-file', '-A', '--author-email', '--match-head-commit', '-R', '--repo']);

const positionals = (args, withValue) => {
  const out = [];
  for (let i = 0; i < args.length; i++) {
    if (withValue.has(args[i])) i++;
    else if (args[i] === '-' || !args[i].startsWith('-')) out.push(args[i]);
  }
  return out;
};

/**
 * What this command would put on `main`, one entry per landing:
 *  · `git merge <ref>` while main is checked out (or after `git checkout main` in
 *    the same command) → { dir, src: ref, bases: ['main', 'origin/main'] }
 *  · `git push` whose destination is main — `main`, `HEAD:main`, `feat:main`,
 *    `--all`, or no refspec while on main → { dir, src, bases: ['<remote>/main'], fallback }
 *  · `gh pr merge` → resolved through `gh pr view` when the hook runs.
 * Not landings: a merge INTO another branch (`git merge main` on a feature branch),
 * `merge --abort|--continue|--quit`, `merge-base`, pushes of other branches.
 */
export function mainLandings(command, cwd) {
  const landings = [];
  let dir = cwd;
  const branch = new Map(); // dir → branch this command has moved it to
  const before = new Map(); // dir → branch before that move (for `git merge -`)
  const branchAt = (d) => (branch.has(d) ? branch.get(d) : checkedOut(d));
  for (const call of gitCalls(command)) {
    if (call.cd !== undefined) {
      dir = resolveDir(dir, call.cd);
      continue;
    }
    if (call.gh) {
      landings.push({ gh: call.gh, dir });
      continue;
    }
    const at = call.C.reduce(resolveDir, dir);
    const { git: sub, args } = call;
    if (sub === 'checkout' || sub === 'switch') {
      const target = checkoutTarget(sub, args);
      if (target === undefined) continue;
      const prev = branchAt(at);
      branch.set(at, target === '-' ? (before.get(at) ?? undefined) : target);
      before.set(at, prev);
    } else if (sub === 'merge') {
      if (args.some((a) => ['--abort', '--continue', '--quit', '-h', '--help'].includes(a))) continue;
      const on = branchAt(at);
      if (on !== 'main' && on !== undefined) continue; // merging INTO another branch
      const refs = positionals(args, MERGE_WITH_VALUE);
      for (const ref of refs.length ? refs : ['@{upstream}']) {
        const src = ref === '-' ? (before.get(at) ?? '@{-1}') : ref;
        landings.push({ dir: at, src, bases: ['main', 'origin/main'] });
      }
    } else if (sub === 'push') {
      const [remote, ...specs] = positionals(args, PUSH_WITH_VALUE);
      const base = /^[\w.-]+$/.test(remote || 'origin') ? `${remote || 'origin'}/main` : 'origin/main';
      const on = branchAt(at);
      const push = (src) => landings.push({ dir: at, src, bases: [base], fallback: src === 'main' ? null : 'main' });
      if (args.some((a) => ['--all', '--branches', '--mirror'].includes(a))) push('main');
      if (!specs.length && on === 'main') push('main');
      for (const spec of specs) {
        const s = spec.replace(/^\+/, '');
        let [src, dst] = s.includes(':') ? s.split(':') : [s, s];
        if (src === 'HEAD') src = on || 'HEAD';
        if (dst === 'HEAD') dst = on || '';
        if (src && dst.replace(/^refs\/heads\//, '') === 'main') push(src);
      }
    }
  }
  return landings;
}

const resolves = (ref, dir) => run('git', ['rev-parse', '--verify', '-q', `${ref}^{commit}`], dir) !== null;

/**
 * Repo-relative files one landing brings to main, or null when git (or gh) cannot
 * say. With several bases the answer is what is new against ALL of them: a stale
 * local `main` must not make other people's already-merged code look like ours.
 */
export function landingFiles(landing) {
  let { dir, src, bases } = landing;
  if (landing.gh) {
    const repo = landing.gh.findIndex((a) => a === '-R' || a === '--repo');
    const sel = positionals(landing.gh, GH_MERGE_WITH_VALUE).slice(0, 1);
    const view = run('gh', ['pr', 'view', ...sel, ...(repo >= 0 ? ['-R', landing.gh[repo + 1]] : []), '--json', 'baseRefName,headRefName'], dir);
    let pr = null;
    try {
      pr = view === null ? null : JSON.parse(view);
    } catch {
      /* unreadable answer */
    }
    if (!pr || typeof pr.baseRefName !== 'string') return null; // gh missing or offline: unknown, never "not main"
    if (pr.baseRefName !== 'main') return [];
    src = [`origin/${pr.headRefName}`, pr.headRefName].find((r) => resolves(r, dir));
    if (!src) return null;
    bases = ['origin/main', 'main'];
  }
  // A push is judged against the remote's main; with no remote-tracking ref, a
  // branch pushed onto main is still judged against the local main.
  let usable = bases.filter((b) => resolves(b, dir));
  if (!usable.length && landing.fallback && resolves(landing.fallback, dir)) usable = [landing.fallback];
  let files = null;
  for (const base of usable) {
    const out = run('git', ['diff', '--name-only', '-z', `${base}...${src}`], dir);
    if (out === null) return null;
    const list = out.split('\0').filter(Boolean);
    files = files === null ? list : files.filter((f) => list.includes(f));
  }
  return files;
}

/** The checkout root of `dir` (where `specs/` lives), or `dir` itself. */
export function repoRoot(dir) {
  return run('git', ['rev-parse', '--show-toplevel'], dir)?.trim() || dir;
}
