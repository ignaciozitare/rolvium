import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Sheet } from '@rolvium/ui';
import type { RollRequest, SheetPatch } from '@rolvium/core';
import type { RollsPort } from '@/modules/dice/domain/ports/RollsPort';
import type { RollOutcome } from '@/modules/dice/domain/entities/Roll';
import { rollsPort as defaultRolls } from '../container';
import { sysT } from '../domain/useCases/systemText';

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
import type { CharacterSheetState } from './useCharacterSheet';
import './characters.css';

interface Props {
  state: CharacterSheetState;
  /** Whether the viewer may edit right now (owner, or DM with «Editar» on). */
  canEdit: boolean;
  rolls?: RollsPort;
  /** Extra roll options from the table (e.g. Destiny dice in hand). */
  rollOptions?: Record<string, unknown>;
  onRolled?: (req: RollRequest, outcome: RollOutcome | null) => void;
  /** Number of dice a stat would roll now — shown on TIRAR (system engine `poolFor`). */
  showActions?: boolean;
}

/**
 * The live sheet: `<Sheet>` from the system schema + damage control + roll wiring.
 * Text: platform strings via t(), game text via the system locales (sysT). Look: --sys-* vars only.
 */
export function CharacterSheetView({ state, canEdit, rolls = defaultRolls, rollOptions, onRolled, showActions = true }: Props): JSX.Element | null {
  const { t, locale } = useTranslation();
  const { character, system, data, derived, applyPatch, applyRemote } = state;
  const [damage, setDamage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const ts = useMemo(() => (system ? sysT(system, locale) : (k: string) => k), [system, locale]);

  const refText = useCallback((key: string) => {
    const r = system?.references[key];
    return r ? { page: r.page, title: ts(r.title), summary: ts(r.summary) } : null;
  }, [system, ts]);

  const poolSize = useCallback((statId: string): number | null => {
    if (!system) return null;
    const req = system.engine.poolFor(data, { stat: statId, ...(rollOptions ? { options: rollOptions } : {}) });
    return req.groups.filter(g => g.tag !== 'opposition').reduce((s, g) => s + g.count, 0);
  }, [system, data, rollOptions]);

  const onAction = useCallback(async (actionId: string, itemId: string) => {
    if (!system || !character) return;
    let req: RollRequest;
    if (actionId === 'roll') req = system.engine.poolFor(data, { stat: itemId, ...(rollOptions ? { options: rollOptions } : {}) });
    else {
      const a = system.engine.actions?.find(x => x.id === actionId);
      if (!a) return;
      /**
       * Lo que la acción gasta se descuenta ANTES de tirar y pase lo que pase con el resultado: la bala
       * sale del cargador aunque falles. `null` = no se puede pagar (sin balas), y entonces no se tira
       * — el botón ya sale apagado, esto es el cinturón por si se llega por otro camino.
       */
      if (a.spend) {
        const cost = a.spend(data, itemId);
        if (!cost) return;
        if (Object.keys(cost).length > 0) applyPatch(cost, 'sheet', true);
      }
      if (!a.toRoll) return;   // acción que sólo gasta (recargar): el `spend` ya la ha hecho entera
      req = a.toRoll(data, itemId, rollOptions);
    }
    req = { ...req, characterId: character.id };
    const res = await rolls.roll({ ...req, campaignId: character.campaignId });
    onRolled?.(req, res);
    if (!res) { setErr(t('characters.sheet.rollFailed')); return; }
    setErr(null);
    const patch = res.result.effects?.patch;
    if (!patch || typeof patch !== 'object') return;
    // The API applies roll effects to the sheet (origin `roll`); we only mirror them. Fallback to the client path if it could not.
    if (res.effectsApplied) applyRemote(patch as SheetPatch, res.sheet);
    else applyPatch(patch as SheetPatch, 'roll', true);
  }, [system, character, data, rollOptions, rolls, onRolled, applyPatch, applyRemote, t, ts]);

  if (!system || !character) return null;
  const labels = { roll: t('characters.sheet.roll'), add: t('characters.sheet.add'), remove: t('characters.sheet.remove'), manual: t('characters.sheet.manual'), of: t('characters.sheet.of'), pick: t('characters.sheet.pickAvatar'), soon: t('characters.sheet.imageSoon') };
  /**
   * El botón parecía roto y no lo estaba: con protección 6, un daño de 5 da 0 y no pasa NADA — ni una
   * casilla, ni un aviso (comprobado en la app corriendo, dueño 2026-08-19). Desde fuera es idéntico a
   * que el botón no funcione. Así que la cuenta se enseña siempre, incluso —sobre todo— cuando el
   * resultado es cero.
   */
  const takeDamage = () => {
    if (damage <= 0) return;
    const patch = system.engine.applyDamage(data, damage);
    const protection = num(derived['protection']);
    const net = Math.max(0, damage - protection);
    const level = str(patch['health']) !== str(data['health'])
      ? t('characters.sheet.damageLevel', { health: ts(`sheet.health.${str(patch['health'])}`) }) : '';
    setDone(net === 0
      ? t('characters.sheet.damageNone', { damage: String(damage), protection: String(protection) })
      : t('characters.sheet.damageResult', { damage: String(damage), protection: String(protection), net: String(net) }) + level);
    applyPatch(patch, 'damage', true);
  };
  // The damage control lives under whichever section holds the `health` field (no per-system ids here).
  const healthSection = system.sheetSchema.sections.find(s => s.fields.some(f => f.type === 'health'))?.id ?? '';
  const damageControl = canEdit ? (
    <div className="ch-damage">
      <input type="number" className="rv-sheet-inp" min={0} value={damage} aria-label={t('characters.sheet.damageAmount')} onChange={e => setDamage(Math.max(0, Number(e.target.value)))} />
      <button type="button" className="rv-sheet-btn" onClick={takeDamage}>{t('characters.sheet.damage')}</button>
      <span className="ch-damage-hint">{done ?? t('characters.sheet.damageHint')}</span>
    </div>
  ) : null;

  return (
    <div className="ch-view">
      {/* El registro de tiradas NO va aqui: esta duplicado con la barra de tiradas de la mesa, que es
          donde lo lee todo el mundo (dueno, 2026-08-19). Solo se queda el aviso de que una tirada fallo,
          porque eso sin decirlo se pierde. */}
      {err && <div className="ch-log" aria-live="polite"><div className="ch-log-item err">{err}</div></div>}
      <Sheet schema={system.sheetSchema} data={data} derived={derived} readOnly={!canEdit} onChange={p => applyPatch(p, 'sheet')}
        actions={system.engine.actions ?? []} {...(showActions ? { onAction: (a: string, i: string) => { void onAction(a, i); } } : {})} catalogs={system.catalogs}
        t={ts} refText={refText} labels={labels} poolSize={poolSize} icons={system.theme.icons ?? {}} showActions={showActions}
        extras={{ [healthSection]: damageControl }} />
    </div>
  );
}
