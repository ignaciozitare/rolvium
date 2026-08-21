import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { CompressError, compressImage, formatBytes, pickImageFile } from '@rolvium/ui';
import type { GameSystem } from '@rolvium/core';
import { STAT_IDS } from '@rolvium/system-plenilunio';
import type { StatId } from '@rolvium/system-plenilunio';
import { initialsOf } from '@/modules/maps/domain/useCases/mapRules';
import { resistanceOf } from '../domain/useCases/bestiaryRules';
import { errorText } from '../domain/useCases/errorText';
import type { BestiaryEntry, CreatureData } from '../domain/entities/BestiaryEntry';
import { SheetOverlay } from './SheetOverlay';

interface Props {
  entry: BestiaryEntry;
  system: GameSystem;
  specialtyLabel: (id: string) => string;
  onSave: (patch: { name: string; notes: string; data: CreatureData; campaignId: string | null; tokenUrl: string | null }) => Promise<void>;
  onUploadImage: (file: Blob) => Promise<string>;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
  campaignId: string;
}

const num = (v: string): number => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 0 ? n : 0; };

/**
 * Ficha del encuentro: crear y editar uno propio.
 *
 * Dos cosas son de diseño, no de capricho (aprobadas por el dueño en el `.pen`):
 *  - La **Resistencia no se teclea**: es Aguante × 3 (p.25) y se recalcula sola al cambiar el Aguante. Dejarla
 *    editable invita a guardar un número que contradice la regla.
 *  - Una característica que el libro NO publica se queda **ausente**, no en 0. El mutante sólo tiene tres
 *    escritas; poner 0 en las otras cuatro sería inventarse el bloque. Por eso hay un botón para quitarle el
 *    valor a una característica, y ausente se pinta «—».
 */
export function EntrySheetModal({ entry, specialtyLabel, onSave, onUploadImage, onDuplicate, onDelete, onClose, campaignId }: Props): JSX.Element {
  const { t, locale } = useTranslation();

  const [name, setName] = useState(entry.name);
  const [notes, setNotes] = useState(entry.notes);
  const [data, setData] = useState<CreatureData>(() => structuredClone(entry.data));
  const [global, setGlobal] = useState(entry.campaignId === null);
  const [tokenUrl, setTokenUrl] = useState(entry.tokenUrl);
  const [busy, setBusy] = useState(false);
  // Subir y guardar son dos esperas distintas: con un solo `busy` el botón Guardar decía «Guardando…»
  // mientras sólo se estaba subiendo una imagen, que es mentirle al director sobre lo que ha pasado.
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savings, setSavings] = useState<string | null>(null);

  const resistance = useMemo(() => resistanceOf(data), [data]);

  const setStat = (stat: StatId, value: number | null) =>
    setData(d => {
      const stats = { ...d.stats };
      if (value === null) delete stats[stat]; else stats[stat] = value;
      return { ...d, stats };
    });

  /**
   * Comprime en el navegador y sube; el compresor devuelve un Blob y no sabe de Supabase.
   *
   * El disparador es el botón «SUBIR IMAGEN (WEBP)» del `.pen`, no el `ImagePicker` de la plataforma:
   * aquél está pintado con tokens de plataforma en estilos en línea (`--sf2`, `--bd`, `--tx3`) y sobre el
   * pergamino salía un recuadro oscuro. Mismo camino que ya usa `NpcSheetModal` — `pickImageFile` +
   * `compressImage` —, así que no se reinventa nada: se pierde el arrastrar-y-soltar, se gana la ficha
   * que el dueño aprobó.
   */
  const upload = useCallback(async () => {
    setError(null);
    const file = await pickImageFile();
    if (!file) return;
    setUploading(true);
    try {
      const r = await compressImage(file, 'token');
      const url = await onUploadImage(r.blob);
      setTokenUrl(url);
      setSavings(r.compressed ? `${formatBytes(r.originalBytes, locale)} → ${formatBytes(r.bytes, locale)}` : null);
    } catch (e) {
      setError(e instanceof CompressError ? t(`bestiary.image.error.${e.code}`) : t('bestiary.image.error.upload'));
    } finally {
      setUploading(false);
    }
  }, [onUploadImage, t, locale]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // `tokenUrl` viaja en el guardado: subir la imagen sólo la deja en el bucket, quien escribe
      // `token_url` en la fila es este patch. Sin él la foto se ve hasta recargar y luego desaparece.
      await onSave({ name: name.trim() || entry.name, notes, data: { ...data, page: data.page }, campaignId: global ? null : campaignId, tokenUrl });
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // «Titulo Derecha» de `PL/Hoja`: de dónde sale la criatura y, si viene del manual, por qué página.
  const origin = [
    t(`bestiary.origin.${entry.origin}`),
    entry.data.page ? t('bestiary.card.page', { n: String(entry.data.page) }) : null,
  ].filter(Boolean).join(' · ');

  return (
    <SheetOverlay title={t('bestiary.sheet.title')} note={origin} width={820} onClose={onClose}>
      <div className="bs-sheet">
        <p className="bs-note">{t('bestiary.sheet.note')}</p>
        {error && <p className="bs-error" role="alert">{error}</p>}

        <div className="bs-sheet-top">
          <div className="bs-sheet-img">
            <div className="bs-sheet-preview">
              {tokenUrl
                ? <img src={tokenUrl} alt="" className="bs-card-photo" />
                : <span className="bs-card-ini" aria-hidden="true">{initialsOf(name)}</span>}
            </div>
            <button type="button" className="bs-btn" onClick={upload} disabled={busy || uploading}>{uploading ? t('common.saving') : t('bestiary.sheet.imageUpload')}</button>
            <p className="bs-sheet-hint">{t('bestiary.sheet.imageHint')}</p>
            {savings && <p className="bs-savings">{t('bestiary.sheet.savings', { s: savings })}</p>}
          </div>

          <div className="bs-sheet-fields">
            <div className="bs-field">
              <label className="bs-label" htmlFor="bs-name">{t('bestiary.sheet.name')}</label>
              <input id="bs-name" className="bs-input" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="bs-field">
              <label className="bs-label" htmlFor="bs-notes">{t('bestiary.sheet.notes')}</label>
              <textarea id="bs-notes" className="bs-textarea" value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
        </div>

        <h4 className="bs-sec">{t('bestiary.sheet.stats')}</h4>
        <ul className="bs-stats">
          {STAT_IDS.map(stat => {
            const value = data.stats[stat];
            const specs = data.specialties[stat] ?? [];
            return (
              <li key={stat} className="bs-stat">
                <span className="bs-stat-name">{t(`bestiary.stat.${stat}`)}</span>
                {value === undefined
                  ? <span className="bs-stat-absent" title={t('bestiary.sheet.absentHint')}>—</span>
                  : <input className="bs-stat-box" type="number" min={0} inputMode="numeric"
                           aria-label={t(`bestiary.stat.${stat}`)} value={value}
                           onChange={e => setStat(stat, num(e.target.value))} />}
                <span className="bs-stat-specs">
                  {specs.length ? specs.map(id => <span key={id} className="bs-spec">{specialtyLabel(id)}</span>)
                                : <span className="bs-stat-none">{t('bestiary.sheet.noSpecialty')}</span>}
                </span>
                <button type="button" className="bs-icon"
                        aria-label={value === undefined ? t('bestiary.sheet.giveValue') : t('bestiary.sheet.clearValue')}
                        onClick={() => setStat(stat, value === undefined ? 0 : null)}>
                  <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>
                    {value === undefined ? 'add' : 'backspace'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="bs-tiles">
          <label className="bs-tile">
            <span className="bs-tile-l">{t('bestiary.sheet.endurance')}</span>
            <input className="bs-tile-in" type="number" min={0} inputMode="numeric" value={data.endurance}
                   onChange={e => setData(d => ({ ...d, endurance: num(e.target.value) }))} />
          </label>
          <label className="bs-tile">
            <span className="bs-tile-l">{t('bestiary.sheet.destiny')}</span>
            <input className="bs-tile-in" type="number" min={0} inputMode="numeric" value={data.destiny}
                   onChange={e => setData(d => ({ ...d, destiny: num(e.target.value) }))} />
          </label>
          <label className="bs-tile">
            <span className="bs-tile-l">{t('bestiary.sheet.protection')}</span>
            <input className="bs-tile-in" type="number" min={0} inputMode="numeric" value={data.protection}
                   onChange={e => setData(d => ({ ...d, protection: num(e.target.value) }))} />
          </label>
          {/* No es un campo: es el resultado de Aguante × 3. Se enseña para poder comprobarlo de un vistazo. */}
          <div className="bs-tile bs-tile-locked">
            <span className="bs-tile-l">{t('bestiary.sheet.resistance')}</span>
            <output className="bs-tile-out" aria-live="polite">{resistance}</output>
            <span className="bs-tile-h">{t('bestiary.sheet.computed')}</span>
          </div>
        </div>

        <label className="bs-scope">
          <input type="checkbox" checked={global} onChange={e => setGlobal(e.target.checked)} />
          <span>{t('bestiary.sheet.allCampaigns')}</span>
          <span className="bs-scope-h">{t('bestiary.sheet.allCampaignsHint')}</span>
        </label>

        {/* El pie del `.pen`: GUARDAR en tinta llena, DUPLICAR con filete y BORRAR con filete de sangre.
            No es el `Btn` de la plataforma: su primario es un degradado de ámbar con halo, que sobre el
            pergamino canta. */}
        <div className="bs-sheet-foot">
          <button type="button" className="bs-btn bs-btn-on bs-btn-lg" onClick={save} disabled={busy || uploading}>
            {busy ? t('common.saving') : t('common.save')}
          </button>
          <button type="button" className="bs-btn bs-btn-lg" onClick={onDuplicate} disabled={busy || uploading}>{t('bestiary.action.duplicate')}</button>
          <span className="bs-card-sp" />
          {entry.editable && (
            <button type="button" className="bs-btn bs-btn-danger bs-btn-lg" onClick={onDelete} disabled={busy || uploading}>{t('common.delete')}</button>
          )}
        </div>
      </div>
    </SheetOverlay>
  );
}
