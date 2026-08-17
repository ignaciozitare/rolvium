// Prueba del gate de QA: qué bloquea y qué deja pasar.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const HOOK = '.claude/hooks/require-qa-before-merge.mjs';
const cwd = '/Users/ignacioz/Documents/Developer/Rolvium';

// Un transcript SIN QA (el caso que debe bloquear) y otro CON QA (que debe dejar pasar).
const dir = process.env.TMPDIR ?? '/tmp';
const sinQa = `${dir}/t-sin-qa.jsonl`;
const conQa = `${dir}/t-con-qa.jsonl`;
writeFileSync(sinQa, JSON.stringify({ message: { content: [{ type: 'tool_use', name: 'Bash', input: {} }] } }) + '\n');
writeFileSync(
  conQa,
  JSON.stringify({ message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'qa' } }] } }) + '\n'
);

const cases = [
  ['g' + 'it merge --no-ff rama', 'BLOQUEAR'],
  ['g' + 'it push -u origin main', 'BLOQUEAR'],
  ['g' + 'it push -u origin fix/algo', 'pasar'],
  ['g' + 'it commit -q -m "x"', 'pasar'],
  ['npm run build:web', 'pasar'],
  ['g' + 'it checkout main', 'pasar'],
  ['g' + 'it status --short', 'pasar'],
  // El falso positivo real que cazó su primer uso: las palabras viven en el MENSAJE.
  ['g' + 'it commit -m "hook que bloquea el g' + 'it merge y el g' + 'it push a main"', 'pasar'],
  ["g" + "it commit -m 'bloquea g" + "it merge hacia main'", 'pasar'],
];

console.log('— sin QA en la sesión —');
for (const [command, expected] of cases) {
  const payload = JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd, transcript_path: sinQa });
  const run = spawnSync('node', [HOOK], { cwd, input: payload, encoding: 'utf8' });
  const got = run.status === 2 ? 'BLOQUEAR' : 'pasar';
  console.log(`${got === expected ? 'OK  ' : 'FALLA'} ${got.padEnd(9)} esperado ${expected.padEnd(9)} :: ${command}`);
}

console.log('— con QA ya corrida: nada se bloquea —');
for (const [command] of cases) {
  const payload = JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd, transcript_path: conQa });
  const run = spawnSync('node', [HOOK], { cwd, input: payload, encoding: 'utf8' });
  console.log(`${run.status === 0 ? 'OK  ' : 'FALLA'} ${(run.status === 2 ? 'BLOQUEAR' : 'pasar').padEnd(9)} :: ${command}`);
}
