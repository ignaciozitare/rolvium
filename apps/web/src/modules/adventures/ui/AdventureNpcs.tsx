import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { ConfirmModal, type NpcLook } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import { initialsOf } from '@/modules/maps';
import {
  CreatureRollPopover, EntrySheetModal, NpcSheetModal, useBestiary,
  type BestiaryEntry, type BestiaryPort,
} from '@/modules/bestiary';
import './adventures.css';

/** Una criatura tal y como la ofrece el picker de una fila: lo justo para elegirla. */
export interface AdventureNpc { id: string; name: string; photoUrl: string | null }

/** Lo que esta pieza le da al documento para que sus filas puedan salir del Bestiario. */
export interface AdventureNpcsApi {
  /** Lo MISMO que lista la pestaña BESTIARIO: los bloques del manual y las entradas propias del director. */
  npcs: readonly AdventureNpc[];
  /** Cómo se pinta una fila enlazada. `null` = esa entrada ya no está. */
  look: (npcId: string) => NpcLook | null;
  openNpc: (npcId: string) => void;
  rollNpc: (npcId: string) => void;
}

interface Props {
  campaignId: string;
  system: GameSystem;
  /** Tira de verdad: el servidor genera los dados y escribe el Registro. Igual que en el Bestiario. */
  onRoll: (req: Parameters<React.ComponentProps<typeof CreatureRollPopover>['onRoll']>[0]) => Promise<unknown>;
  repo?: BestiaryPort;
  children: (api: AdventureNpcsApi) => ReactNode;
}

/**
 * EL BESTIARIO DENTRO DE UNA AVENTURA (H5 × H12) — orden suya del 2026-09-22: «*los encuentros y personajes
 * ademas de una opcion de tabl acom lo pusiste que esta bien deberia poder elegirlos del bestiario*», y a la
 * pregunta de qué debe ofrecer una fila enlazada contestó «**b**»: nombre y foto, **ver su ficha** y **tirar
 * por él**. Colocarla en la escena desde aquí NO entra (era la «c»).
 * Lámina: `rolvium.pen` § 4 · `Aventuras/Fila del BESTIARIO · elegir a alguien y lo que ofrece`.
 *
 * Vive aquí, y no dentro del editor, por dos motivos:
 *  - El editor es de `@rolvium/ui` y lo comparten Notas y Bitácora: **no puede conocer el Bestiario**. Él
 *    pregunta (`npcLook`) y avisa (`onOpenNpc`, `onRollNpc`); quien contesta es esto.
 *  - La ficha y el desplegable de tirar son LOS DEL BESTIARIO, sin una sola copia: `EntrySheetModal`,
 *    `NpcSheetModal` y `CreatureRollPopover` entran por la puerta del módulo (`@/modules/bestiary`).
 *
 * Es una función hija («render prop») porque las dos superficies que escriben una aventura —la pestaña de la
 * mesa y la ventana aparte— necesitan exactamente lo mismo, y así se monta una vez.
 */
export function AdventureNpcs({ campaignId, system, onRoll, repo, children }: Props): JSX.Element {
  const { t } = useTranslation();
  const bs = useBestiary({ campaignId, system, ...(repo ? { repo } : {}) });
  const [sheet, setSheet] = useState<BestiaryEntry | null>(null);
  const [rolling, setRolling] = useState<BestiaryEntry | null>(null);
  const [deleting, setDeleting] = useState<BestiaryEntry | null>(null);

  const byId = useMemo(() => new Map(bs.entries.map(e => [e.id, e])), [bs.entries]);
  const npcs = useMemo(
    () => bs.entries.map(e => ({ id: e.id, name: e.name, photoUrl: e.tokenUrl })),
    [bs.entries],
  );

  const api: AdventureNpcsApi = {
    npcs,
    look: npcId => {
      const e = byId.get(npcId);
      return e ? { name: e.name, photoUrl: e.tokenUrl, initials: initialsOf(e.name) } : null;
    },
    openNpc: npcId => { const e = byId.get(npcId); if (e) setSheet(e); },
    rollNpc: npcId => { const e = byId.get(npcId); if (e) setRolling(e); },
  };

  return (
    <>
      {children(api)}

      {sheet?.origin === 'npc' && (
        <NpcSheetModal
          entry={sheet} system={system} campaignId={campaignId}
          onSave={async patch => { await bs.update(sheet.id, patch); }}
          onUploadImage={file => bs.repo.uploadToken(sheet.id, file)}
          onDelete={() => { setDeleting(sheet); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet && sheet.origin !== 'npc' && (
        <EntrySheetModal
          entry={sheet} system={system} campaignId={campaignId} specialtyLabel={bs.specialtyLabel}
          onSave={async patch => { await bs.update(sheet.id, patch); }}
          onUploadImage={file => bs.repo.uploadToken(sheet.id, file)}
          onDuplicate={async () => setSheet(await bs.duplicate(sheet))}
          onDelete={() => { setDeleting(sheet); setSheet(null); }}
          onClose={() => setSheet(null)}
        />
      )}

      {/*
        * El MISMO desplegable del Bestiario. Allí cuelga de su ficha del catálogo (`.bs-pop` dentro de
        * `.bs-card`); aquí no hay ficha de la que colgar —la fila es una línea de texto—, así que se le da un
        * sitio propio centrado, igual que ya hace `TokenAttackModal` sobre la escena (`.bs-atk`).
        */}
      {rolling && (
        <div className="av-npcroll">
          <CreatureRollPopover
            entry={rolling} system={system} specialtyLabel={bs.specialtyLabel}
            onRoll={onRoll} onClose={() => setRolling(null)}
          />
        </div>
      )}

      {deleting && (
        <ConfirmModal
          danger
          message={t('bestiary.deleteConfirm', { name: deleting.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => { await bs.remove(deleting.id); setDeleting(null); }}
        />
      )}
    </>
  );
}
