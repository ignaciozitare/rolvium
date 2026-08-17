#!/usr/bin/env node
// PreToolUse hook — context-handoff gate («fumarse el contexto» nunca más).
//
// EL FALLO QUE CIERRA (medido en el proyecto hermano WorkSuite, 2026-08-08): la
// regla del traspaso de contexto —
// «cuando el chat está largo: WORK_STATE al día + chat nuevo, nunca seguir» — era
// de honor, y las reglas de honor se saltan (mismo hallazgo del 2026-07-29 que
// justificó el gate de change-safety). El agente se pasó una noche entera
// trabajando en un chat ya quemado después de que el dueño pidiera explícitamente
// el traspaso.
//
// ── EL DISEÑO QUE EL DUEÑO PIDIÓ (2026-08-08) ───────────────────────────────
// «Parabas a cada comando y me obligabas a estar frente al ordenador»: el intento
// anterior gateaba comandos y le pedía permiso a ÉL. Este no:
//   · NO mira Bash ni lecturas — solo Write/Edit/MultiEdit de CÓDIGO.
//   · NO le pregunta nada al dueño — deniega al AGENTE, con la instrucción de
//     traspasar. El dueño no tiene que estar delante.
//   · Solo actúa cuando la transcripción REAL de la sesión supera el umbral
//     (por defecto 6 MB de JSONL — las sesiones que acabaron mal en WorkSuite
//     pasaban de 10). Por debajo, silencio absoluto: cero fricción.
//   · El traspaso mismo nunca se bloquea: markdown, specs/, .claude/ y scratch
//     siguen abiertos SIEMPRE (misma lista exenta que change-safety), así el
//     agente puede escribir WORK_STATE y despedirse.
//
// FAILS OPEN en toda duda (payload malo, transcripción ilegible): un cambio de
// harness jamás puede colgar el repo entero.
//
// Ajustes del dueño:
//   ROLVIUM_HANDOFF_LIMIT_MB=<n>  — umbral en MB (por defecto 6)
//   ROLVIUM_SKIP_HANDOFF=1        — desactiva el gate por completo

import { existsSync, statSync } from 'node:fs';

const allow = () => process.exit(0);

if (process.env.ROLVIUM_SKIP_HANDOFF === '1') allow();

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
  allow(); // payload malformado → jamás bloquear trabajo real
}

const tool = input?.tool_name || '';
if (!['Write', 'Edit', 'MultiEdit'].includes(tool)) allow();

const fp = String(input?.tool_input?.file_path || '').replace(/\\/g, '/');

// El traspaso (y cualquier documentación) nunca se bloquea — misma lista que el
// gate de change-safety, mismo principio: escribir lo entendido siempre es legal.
const EXEMPT = [
  /\.mdx?$/i,
  /(?:^|\/)specs\//,
  /(?:^|\/)\.claude\//,
  /(?:^|\/)node_modules\//,
  /(?:^|\/)(?:dist|build|coverage)\//,
  /(?:^|\/)package-lock\.json$/,
  /\/scratchpad\//,
  /^\/(?:tmp|private\/tmp|var\/folders)\//,
];
if (fp === '' || EXEMPT.some((re) => re.test(fp))) allow();

const transcriptPath = input?.transcript_path;
if (!transcriptPath || !existsSync(transcriptPath)) allow();

const limitMb = Number(process.env.ROLVIUM_HANDOFF_LIMIT_MB || '6');
if (!Number.isFinite(limitMb) || limitMb <= 0) allow();

let sizeMb = 0;
try {
  sizeMb = statSync(transcriptPath).size / (1024 * 1024);
} catch {
  allow();
}
if (sizeMb <= limitMb) allow();

const msg = [
  `⛔ CONTEXT-HANDOFF GATE — esta sesión ya quemó ${sizeMb.toFixed(1)} MB de transcripción (umbral: ${limitMb} MB).`,
  '',
  'No sigas programando en este chat. El protocolo es el de CLAUDE.md:',
  '  1. Actualizá WORK_STATE.md — bloque 🟢 arriba: tarea, punto exacto, decisiones,',
  '     próximo paso, y el prompt de resume de una línea. (Los .md no están bloqueados.)',
  '  2. Commiteá lo commiteable.',
  '  3. Decile al dueño que abras un chat nuevo con ese prompt — y PARÁ acá.',
  '',
  'Los edits de código quedan bloqueados en esta sesión. Un chat fresco retomado de',
  'WORK_STATE es más fiable que este contexto: no se pierde nada (git + DB + WORK_STATE).',
  '',
  '(Ajustes del dueño: ROLVIUM_HANDOFF_LIMIT_MB=<n> · ROLVIUM_SKIP_HANDOFF=1.)',
].join('\n');
process.stderr.write(msg + '\n');
process.exit(2);
