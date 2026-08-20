import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, Modal, Sheet } from '@rolvium/ui';
import type { GameSystem, SheetPatch } from '@rolvium/core';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import type { BestiaryEntry, CreatureData } from '../domain/entities/BestiaryEntry';

interface Props {
  entry: BestiaryEntry;
  system: GameSystem;
  onSave: (patch: { name: string; data: CreatureData; campaignId: string | null }) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  campaignId: string;
}

/**
 * Ficha COMPLETA de un PNJ aliado — el mismo `<Sheet>` que un personaje jugador, dirigido por el esquema
 * del sistema de juego.
 *
 * Se reutiliza el componente entero en vez de escribir una ficha de PNJ aparte: un aliado tiene dones,
 * armas, equipo y salud igual que un PJ, y mantener dos fichas que se parecen es garantía de que una se
 * quede vieja. Lo único distinto es de dónde salen y a dónde van los datos: aquí a la fila del bestiario,
 * no a `characters`.
 *
 * **No se guarda solo.** La ficha de un PJ va salvando sola porque su dueño la tiene abierta en la mesa;
 * esta es una ventana que el director abre y cierra, y un guardado automático dentro de un modal deja al
 * director sin saber si lo que tocó quedó guardado. Hay botón, y el botón dice si hay cambios sin guardar.
 */
export function NpcSheetModal({ entry, system, onSave, onDelete, onClose, campaignId }: Props): JSX.Element {
  const { t, locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);

  const [name, setName] = useState(entry.name);
  const [sheet, setSheet] = useState<Record<string, unknown>>(() => structuredClone(entry.data.sheet ?? {}));
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const derived = useMemo(() => system.engine.derived(sheet), [system, sheet]);

  const refText = useCallback((key: string) => {
    const r = system.references[key];
    return r ? { page: r.page, title: ts(r.title), summary: ts(r.summary) } : null;
  }, [system, ts]);

  const poolSize = useCallback((statId: string): number | null => {
    const req = system.engine.poolFor(sheet, { stat: statId });
    return req.groups.filter(g => g.tag !== 'opposition').reduce((s, g) => s + g.count, 0);
  }, [system, sheet]);

  const labels = {
    roll: t('characters.sheet.roll'), add: t('characters.sheet.add'), remove: t('characters.sheet.remove'),
    manual: t('characters.sheet.manual'), of: t('characters.sheet.of'),
    pick: t('characters.sheet.pickAvatar'), soon: t('characters.sheet.imageSoon'),
  };

  const apply = (patch: SheetPatch) => { setSheet(s => ({ ...s, ...patch })); setDirty(true); };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // El nombre del listado y el de la ficha son el mismo dato: si el director lo cambia dentro de la
      // ficha, el listado tiene que enterarse, o tendría dos nombres para el mismo PNJ.
      const fromSheet = typeof sheet['name'] === 'string' && sheet['name'].trim() ? (sheet['name'] as string).trim() : null;
      await onSave({ name: fromSheet ?? name.trim() ?? entry.name, data: { ...entry.data, sheet }, campaignId: entry.campaignId === null ? null : campaignId });
      setDirty(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t('bestiary.npc.title', { name })} onClose={onClose} width={980}>
      <div className="bs-npc">
        <p className="bs-note">{t('bestiary.npc.note')}</p>
        {error && <p className="bs-error" role="alert">{error}</p>}

        <Sheet
          schema={system.sheetSchema} data={sheet} derived={derived} readOnly={false}
          onChange={apply} actions={system.engine.actions ?? []} catalogs={system.catalogs}
          t={ts} refText={refText} labels={labels} poolSize={poolSize}
          icons={system.theme.icons ?? {}} showActions={false}
        />

        <div className="bs-sheet-foot">
          <Btn variant="primary" onClick={save} loading={busy}>
            {dirty ? t('bestiary.npc.saveDirty') : t('common.save')}
          </Btn>
          <span className="bs-card-sp" />
          <Btn variant="danger" onClick={onDelete}>{t('common.delete')}</Btn>
        </div>
      </div>
    </Modal>
  );
}
