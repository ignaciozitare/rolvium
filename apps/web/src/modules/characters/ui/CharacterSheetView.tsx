import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { CompressError, Sheet, compressImage, pickImageFile } from '@rolvium/ui';
import type { RollRequest, SheetPatch } from '@rolvium/core';
import type { RollsPort } from '@/modules/dice/domain/ports/RollsPort';
import type { RollOutcome } from '@/modules/dice/domain/entities/Roll';
import { charactersRepo, rollsPort as defaultRolls } from '../container';
import { sysT } from '../domain/useCases/systemText';
import { type RollIntent, opensPopover, previewRequest } from '../domain/useCases/rollIntent';
import { RollPopover, type SharedPoolHandle } from './RollPopover';

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
  /**
   * La reserva compartida de la mesa, para el desplegable de tirar. En la ficha aparte
   * (`/characters/:id`) no hay mesa: sin reserva, esa parte del desplegable no se pinta.
   */
  pool?: SharedPoolHandle;
  onRolled?: (req: RollRequest, outcome: RollOutcome | null) => void;
  /** Number of dice a stat would roll now — shown on TIRAR (system engine `poolFor`). */
  showActions?: boolean;
}

/**
 * The live sheet: `<Sheet>` from the system schema + damage control + roll wiring.
 * Text: platform strings via t(), game text via the system locales (sysT). Look: --sys-* vars only.
 */
export function CharacterSheetView({ state, canEdit, rolls = defaultRolls, rollOptions, pool, onRolled, showActions = true }: Props): JSX.Element | null {
  const { t, locale } = useTranslation();
  const { character, system, data, derived, applyPatch, applyRemote } = state;
  const [damage, setDamage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Desplegable de tirar abierto, con el rectángulo del botón que lo abrió. */
  const [open, setOpen] = useState<{ intent: RollIntent; anchor: DOMRect | null } | null>(null);
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

  /**
   * Tira de verdad: gasta lo que la acción cueste y manda la petición. Devuelve `false` si no se pudo,
   * que es lo que el desplegable necesita para quedarse abierto y decirlo, en vez de cerrarse en falso.
   */
  const fire = useCallback(async (intent: RollIntent, options: Record<string, unknown>): Promise<boolean> => {
    if (!system || !character) return false;
    if (intent.kind === 'action') {
      /**
       * Lo que la acción gasta se descuenta ANTES de tirar y pase lo que pase con el resultado: la bala
       * sale del cargador aunque falles. `null` = no se puede pagar (sin balas), y entonces no se tira
       * — el botón ya sale apagado, esto es el cinturón por si se llega por otro camino.
       */
      if (intent.action.spend) {
        const cost = intent.action.spend(data, intent.itemId);
        if (!cost) return false;
        if (Object.keys(cost).length > 0) applyPatch(cost, 'sheet', true);
      }
      if (!intent.action.toRoll) return true;   // acción que sólo gasta (recargar): el `spend` ya la ha hecho entera
    }
    const built = previewRequest(system, data, intent, options);
    if (!built) return false;
    const req = { ...built, characterId: character.id };
    const res = await rolls.roll({ ...req, campaignId: character.campaignId });
    onRolled?.(req, res);
    if (!res) { setErr(t('characters.sheet.rollFailed')); return false; }
    setErr(null);
    const patch = res.result.effects?.patch;
    if (!patch || typeof patch !== 'object') return true;
    // The API applies roll effects to the sheet (origin `roll`); we only mirror them. Fallback to the client path if it could not.
    if (res.effectsApplied) applyRemote(patch as SheetPatch, res.sheet);
    else applyPatch(patch as SheetPatch, 'roll', true);
    return true;
  }, [system, character, data, rolls, onRolled, applyPatch, applyRemote, t]);

  /**
   * El botón ya NO tira: abre su desplegable (`rolvium.pen` «Mesa/Tiradas · rediseño», columnas 1 y 2),
   * y se tira al confirmar. Sólo TIRAR de una característica y la acción de un arma; activar un don y
   * recargar siguen yendo directas, como estaban — el `.pen` no las diseña.
   */
  const onAction = useCallback((actionId: string, itemId: string, _options?: Record<string, unknown>, anchor?: DOMRect) => {
    if (!system) return;
    const act = actionId === 'roll' ? null : system.engine.actions?.find(x => x.id === actionId);
    const intent: RollIntent | null = actionId === 'roll' ? { kind: 'stat', statId: itemId } : act ? { kind: 'action', action: act, itemId } : null;
    if (!intent) return;
    if (opensPopover(system, intent)) { setErr(null); setOpen({ intent, anchor: anchor ?? null }); return; }
    void fire(intent, rollOptions ?? {});
  }, [system, fire, rollOptions]);

  if (!system || !character) return null;
  /**
   * Subir el avatar. El `<Sheet>` ya traía el enganche `onImagePick` desde que se escribió, y
   * `charactersRepo.uploadImage` ya sabía subir: lo único que faltaba era juntarlos, y por eso la ficha
   * llevaba meses diciendo «Subir imagen: pronto».
   *
   * Se comprime EN EL NAVEGADOR antes de subir (specs/core/images): 512 px y WebP para un avatar que se
   * pinta a 64 px como mucho. Si el navegador no sabe hacer WebP, `compressImage` devuelve el original y
   * la subida sigue: no se deja a nadie sin avatar por una optimización.
   */
  const [imageError, setImageError] = useState<string | null>(null);
  const onImagePick = useCallback(async (fieldId: string) => {
    if (!character) return;
    setImageError(null);
    const file = await pickImageFile();
    if (!file) return;                                   // el usuario canceló: no es un error
    try {
      const { blob } = await compressImage(file, 'avatar');
      const url = await charactersRepo.uploadImage('avatar', character.id, blob);
      applyPatch({ [fieldId]: url }, 'sheet');
    } catch (e) {
      setImageError(e instanceof CompressError ? t(`characters.sheet.imageError.${e.code}`) : t('characters.sheet.imageError.upload'));
    }
  }, [character, applyPatch, t]);

  const labels = { roll: t('characters.sheet.roll'), add: t('characters.sheet.add'), remove: t('characters.sheet.remove'), manual: t('characters.sheet.manual'), of: t('characters.sheet.of'), pick: t('characters.sheet.pickAvatar') };
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
      {imageError && <div className="ch-log" aria-live="polite"><div className="ch-log-item err" role="alert">{imageError}</div></div>}
      <Sheet schema={system.sheetSchema} data={data} derived={derived} readOnly={!canEdit} onChange={p => applyPatch(p, 'sheet')}
        actions={system.engine.actions ?? []} {...(showActions ? { onAction } : {})} catalogs={system.catalogs}
        t={ts} refText={refText} labels={labels} poolSize={poolSize} icons={system.theme.icons ?? {}} showActions={showActions}
        {...(canEdit ? { onImagePick } : {})}
        extras={{ [healthSection]: damageControl }} />
      {open && (
        <RollPopover system={system} data={data} intent={open.intent} anchor={open.anchor} ts={ts} baseOptions={rollOptions ?? {}}
          {...(pool ? { pool } : {})}
          onCancel={() => setOpen(null)}
          onConfirm={async options => { const ok = await fire(open.intent, options); if (ok) setOpen(null); return ok; }} />
      )}
    </div>
  );
}
