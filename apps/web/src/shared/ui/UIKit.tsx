import { useState } from 'react';
import { Btn, Card, Chip, Badge, Modal, DualPanelPicker, UserAvatar, Field, SystemChip, StatusChip, SectionTitle, PageHeader, EmptyState, Sheet, Tooltip } from '@rolvium/ui';
import type { SheetData } from '@rolvium/core';
import { plenilunio } from '@rolvium/system-plenilunio';
import { sysT } from '@/modules/characters/domain/useCases/systemText';

/**
 * Live catalogue of @rolvium/ui. Every new shared component gets an example
 * here (rule in CLAUDE.md). Route: /ui-kit (authenticated).
 */
export function UIKit(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string[]>(['b']);
  const [sheet, setSheet] = useState<SheetData>(() => ({ ...plenilunio.newSheet(), name: 'Karen «K»', concept: 'Líder de banda' }));
  const sysVars = Object.fromEntries(Object.entries(plenilunio.theme.vars).map(([k, v]) => [`--sys-${k}`, v]));
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, background: 'var(--bg)', minHeight: '100vh', color: 'var(--tx)' }}>
      <div className="rv-page-title">UI Kit</div>
      <section><h3 style={{ marginBottom: 8 }}>Btn</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn variant="primary">primary</Btn><Btn variant="ghost">ghost</Btn><Btn variant="outline">outline</Btn><Btn variant="success">success</Btn><Btn variant="warn">warn</Btn><Btn variant="danger">danger</Btn>
        </div>
      </section>
      <section><h3 style={{ marginBottom: 8 }}>Card / Chip / Badge / UserAvatar</h3>
        <Card><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><UserAvatar user={{ name: 'Ada Lovelace' }} size={30} /><Chip>chip</Chip><Badge>badge</Badge></div></Card>
      </section>
      <section><h3 style={{ marginBottom: 8 }}>Field / SystemChip / StatusChip (rolvium.pen Components)</h3>
        <div style={{ maxWidth: 360 }}><Field id="kit-email" label="Correo" placeholder="tu@correo.com" hint="Texto de ayuda" /><Field id="kit-code" label="Código" code placeholder="LUNA-4F7K" error="Ese código no vale" /></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}><SystemChip>Plenilunio</SystemChip><SystemChip muted>Cyberpunk · pronto</SystemChip><StatusChip tone="green">Activa</StatusChip><StatusChip tone="purple">Diriges</StatusChip><StatusChip tone="amber">Sistema no instalado</StatusChip><StatusChip tone="gray">Borrador</StatusChip></div>
      </section>
      <section><h3 style={{ marginBottom: 8 }}>PageHeader / SectionTitle / EmptyState</h3>
        <PageHeader title="Hola, Ignacio" subtitle="Subtítulo de página" actions={<Btn variant="primary">Acción</Btn>} />
        <SectionTitle style={{ marginTop: 16 }}>Mis campañas</SectionTitle>
        <Card><EmptyState icon="auto_stories" title="Todavía no estás en ninguna campaña" description="Crea una como director o únete con un código." actions={<Btn variant="primary">Crear campaña</Btn>} /></Card>
      </section>
      <section><h3 style={{ marginBottom: 8 }}>Sheet (schema-driven, themed by --sys-* vars — here Plenilunio's)</h3>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--tx2)', marginBottom: 8 }}>{"import { Sheet } from '@rolvium/ui'"} · {'<Sheet schema data derived onChange onAction actions t refText labels icons />'}</p>
        <div style={{ ...sysVars, padding: 16, background: 'var(--sys-bg)', fontFamily: 'var(--sys-font-body)' } as React.CSSProperties}>
          <Sheet schema={plenilunio.sheetSchema} data={sheet} derived={plenilunio.engine.derived(sheet)} onChange={p => setSheet(d => ({ ...d, ...p }))} onAction={() => undefined} actions={plenilunio.engine.actions ?? []}
            catalogs={plenilunio.catalogs} t={sysT(plenilunio, 'es')} refText={k => { const r = plenilunio.references[k]; return r ? { page: r.page, title: sysT(plenilunio, 'es')(r.title), summary: sysT(plenilunio, 'es')(r.summary) } : null; }}
            labels={{ roll: 'Tirar', add: 'Añadir', remove: 'Quitar', manual: 'Manual', of: 'de' }} icons={plenilunio.theme.icons ?? {}} />
        </div>
      </section>
      <section><h3 style={{ marginBottom: 8 }}>Tooltip (table primitive, themed by --sys-* — hover or Tab into a button)</h3>
        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--tx2)', marginBottom: 8 }}>{"import { Tooltip } from '@rolvium/ui'"} · {'<Tooltip label="Muro" placement="right">…</Tooltip>'}</p>
        <div style={{ ...sysVars, padding: 24, display: 'flex', gap: 24, background: 'var(--sys-bg)' } as React.CSSProperties}>
          {(['right', 'top', 'bottom', 'left'] as const).map(place => (
            <Tooltip key={place} label={place.toUpperCase()} placement={place}>
              <button type="button" aria-label={`Ejemplo ${place}`} style={{ width: 34, height: 34, border: 'none', background: 'var(--sys-paper-hi)', color: 'var(--sys-ink-soft)', cursor: 'pointer' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>fence</span>
              </button>
            </Tooltip>
          ))}
        </div>
      </section>
      <section><h3 style={{ marginBottom: 8 }}>Modal</h3>
        <Btn variant="primary" onClick={() => setOpen(true)}>open modal</Btn>
        {open && <Modal title="Example" onClose={() => setOpen(false)}>Hello from the modal.</Modal>}
      </section>
      <section><h3 style={{ marginBottom: 8 }}>DualPanelPicker</h3>
        <DualPanelPicker label="Pick" allItems={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C', hint: 'with hint' }]} selected={sel}
          onAdd={v => setSel(s => [...s, v])} onRemove={v => setSel(s => s.filter(x => x !== v))} />
      </section>
    </div>
  );
}
