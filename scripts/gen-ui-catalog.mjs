#!/usr/bin/env node
// Generates packages/ui/CATALOG.md — a concise, agent-readable index of every
// component exported by @rolvium/ui. ZERO dependencies, ZERO LLM tokens.
//
//   node scripts/gen-ui-catalog.mjs          # regenerate the catalog (npm run ui:catalog)
//   node scripts/gen-ui-catalog.mjs --check  # fail (exit 1) if catalog is stale
//
// WHY: UIKit.tsx is a long JSX showcase — too expensive to read, so components
// get reinvented. This catalog is ~2 screens: read it BEFORE building any UI.
//
// The component LIST auto-syncs from index.ts (a new export appears here
// automatically). The prose columns live in META below — a new component with
// no META entry is emitted as "⚠️ UNDOCUMENTED" so it never silently rots.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'packages/ui/src/index.ts');
const OUT = path.join(ROOT, 'packages/ui/CATALOG.md');

// ── Hand-maintained metadata: what each component resolves + how to use it ──
// Keep this in sync when you ADD a component. The generator flags anything
// exported-but-missing here, so you'll be reminded.
const META = {
  Field:              { resolves: 'campo de formulario del .pen: label ALL-CAPS + input + error/hint + trailing (icono)', usage: '<Field id label value onChange error trailing>' },
  SystemChip:         { resolves: 'chip de sistema de juego (icono + nombre; muted si no instalado)', usage: '<SystemChip muted>Plenilunio</SystemChip>' },
  StatusChip:         { resolves: 'chip de estado con punto (green/purple/amber/red/gray)', usage: '<StatusChip tone="green">Activa</StatusChip>' },
  SectionTitle:       { resolves: 'título de sección ALL-CAPS con línea', usage: '<SectionTitle>Mis campañas</SectionTitle>' },
  PageHeader:         { resolves: 'cabecera de página: título display + subtítulo + acciones', usage: '<PageHeader title subtitle actions>' },
  EmptyState:         { resolves: 'estado vacío/error centrado con icono, texto y acciones', usage: '<EmptyState icon title description actions>' },
  TopBar:             { resolves: 'barra superior del shell: marca · links · cluster derecho (router-agnóstica)', usage: '<TopBar brand links right>' },
  Btn:                { resolves: 'botón (primary/ghost/semantic) con estados y glow', usage: '<Btn variant="primary" onClick>' },
  Card:               { resolves: 'contenedor elevado sin líneas divisorias', usage: '<Card variant>...</Card>' },
  Modal:              { resolves: 'overlay/diálogo con foco atrapado y cierre por ESC', usage: '<Modal open onClose title>' },
  ConfirmModal:       { resolves: 'confirmación de acción destructiva', usage: '<ConfirmModal open onConfirm onCancel>' },
  DialogProvider:     { resolves: 'contexto para abrir modales imperativamente', usage: 'useDialog().confirm(...)' },
  DateRangePicker:    { resolves: 'selección de rango de fechas con presets', usage: '<DateRangePicker value onChange>' },
  MultiSelectDropdown:{ resolves: 'selección múltiple con búsqueda', usage: '<MultiSelectDropdown items value onChange>' },
  DualPanelPicker:    { resolves: 'transferencia entre dos paneles (disponible/seleccionado)', usage: '<DualPanelPicker items value>' },
  IconPicker:         { resolves: 'selector de icono Material Symbols', usage: '<IconPicker value onChange>' },
  ColorPicker:        { resolves: 'selector de color de la paleta del sistema', usage: '<ColorPicker value onChange>' },
  ImagePicker:        { resolves: 'subida/recorte de imagen o avatar', usage: '<ImagePicker shape onChange>' },
  DataTable:          { resolves: 'tabla con columnas reordenables/redimensionables, sort por click en título y paginación opcional', usage: '<DataTable columns rows sortable pageSize>' },
  UserAvatar:         { resolves: 'avatar de usuario (preset o imagen) con iniciales', usage: '<UserAvatar user size>' },
  Avatar:             { resolves: 'avatar genérico (átomo)', usage: '<Avatar src initials>' },
  Badge:              { resolves: 'badge/contador (átomo)', usage: '<Badge>3</Badge>' },
  Chip:               { resolves: 'chip semántico (success/error/warning)', usage: '<Chip tone>...</Chip>' },
  StatBox:            { resolves: 'métrica/KPI con label (átomo)', usage: '<StatBox label value>' },
  Divider:            { resolves: 'separador tonal (átomo)', usage: '<Divider />' },
};

function exportedComponents(src) {
  const names = new Set();
  const re = /export\s*\{([^}]*)\}\s*from\s*['"]\.\/components\/[^'"]+['"]/g;
  let m;
  while ((m = re.exec(src))) {
    for (let id of m[1].split(',')) {
      id = id.trim().split(/\s+as\s+/).pop().trim();
      if (!id) continue;
      // components are PascalCase; exclude hooks (useX), helpers (getX),
      // and ALL_CAPS constants (AVATAR_PRESETS, COLOR_PICKER_PALETTE...)
      if (/^[A-Z]/.test(id) && !/^[A-Z0-9_]+$/.test(id)) names.add(id);
    }
  }
  return [...names];
}

function buildMarkdown(components) {
  const rows = components.sort().map((name) => {
    const meta = META[name];
    if (!meta) return `| \`${name}\` | ⚠️ UNDOCUMENTED — añadí metadata en gen-ui-catalog.mjs | — |`;
    return `| \`${name}\` | ${meta.resolves} | \`${meta.usage}\` |`;
  });
  return `<!-- AUTO-GENERATED by scripts/gen-ui-catalog.mjs — do NOT edit by hand.
     Regenerate with: npm run ui:catalog (node scripts/gen-ui-catalog.mjs) -->

# @rolvium/ui — Component catalog

**Leé esto ANTES de crear cualquier elemento visual.** Si un componente de acá
resuelve tu necesidad, reutilizalo — no reinventes un modal/botón/card local.

Import: \`import { X } from '@rolvium/ui'\`

| Componente | Resuelve | Uso |
|---|---|---|
${rows.join('\n')}

> Fuente de verdad del código: \`packages/ui/src/index.ts\`.
> Ejemplos vivos e interactivos: \`apps/web/src/shared/ui/UIKit.tsx\`.
> ${components.length} componentes exportados.
`;
}

const src = fs.readFileSync(INDEX, 'utf8');
const components = exportedComponents(src);
const md = buildMarkdown(components);

const check = process.argv.includes('--check');
if (check) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current.trim() !== md.trim()) {
    console.error('✗ packages/ui/CATALOG.md is stale. Run: node scripts/gen-ui-catalog.mjs');
    process.exit(1);
  }
  console.log('✓ CATALOG.md up to date.');
  process.exit(0);
}

fs.writeFileSync(OUT, md);
const undocumented = components.filter((c) => !META[c]);
console.log(`✓ wrote ${path.relative(ROOT, OUT)} — ${components.length} components` +
  (undocumented.length ? `, ${undocumented.length} UNDOCUMENTED: ${undocumented.join(', ')}` : ''));
