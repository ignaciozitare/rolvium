import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Card, type CompressionLevel } from '@rolvium/ui';
import type { CompressionLevelsPort } from '@/shared/settings/CompressionLevelsPort';
import { DEFAULT_COMPRESSION_LEVELS, type CompressionLevels } from '@/shared/settings/compressionLevels';

/**
 * rolvium.pen `Admin/Ajustes` (aprobado el 2026-09-14). Ajustes es una pantalla CON PESTAÑAS: hoy sólo está
 * «Imágenes», y las siguientes se añaden a esta lista según vayan haciendo falta (orden suyo: «*tendremos
 * pestañas dentro de la opción de ajustes … luego cuando vayamos agregando más se irán agregando*»).
 */
const TABS = [{ id: 'images', labelKey: 'admin.settingsTab.images' }] as const;
type TabId = (typeof TABS)[number]['id'];

const LEVELS: readonly CompressionLevel[] = ['light', 'balanced', 'max'];
/** Los tres destinos con nivel. Avatar y token van fijos, sin nivel (spec `specs/core/images/SPEC.md`). */
const KINDS: readonly (keyof CompressionLevels)[] = ['texture', 'prop', 'background'];

export function AdminSettings({ compressionLevels }: { compressionLevels: CompressionLevelsPort }): JSX.Element {
  const { t } = useTranslation();
  const uid = useId();
  const [tab, setTab] = useState<TabId>('images');
  const [levels, setLevels] = useState<CompressionLevels>(DEFAULT_COMPRESSION_LEVELS);
  const [err, setErr] = useState<string | null>(null);
  /** Lo leído es de ANTES de tocar nada: si la lectura tarda y ya se ha elegido algo, no lo pisa. */
  const picked = useRef(false);
  /** Lo que sabemos que hay GUARDADO, no lo que se ve. `null` = todavía no se ha podido leer. */
  const guardado = useRef<CompressionLevels | null>(null);
  /** La lectura en vuelo, para esperarla en vez de pedir la fila otra vez. Nunca rechaza: `null` = no se pudo. */
  const lectura = useRef<Promise<CompressionLevels | null> | null>(null);

  useEffect(() => {
    const p = compressionLevels.load().then(saved => saved ?? DEFAULT_COMPRESSION_LEVELS).catch(() => null);
    lectura.current = p;
    void p.then(saved => { if (!saved) return; guardado.current = saved; if (!picked.current) setLevels(saved); });
  }, [compressionLevels]);

  /**
   * Se guarda al elegir, sin botón, como los ajustes de «Mi cuenta». Si la base dice que no (sin
   * `manage_settings`), se deshace en pantalla para no enseñar un nivel que no está guardado. Se deshace
   * SÓLO el tipo que falló: si mientras tanto se ha elegido otro, ese no se toca.
   *
   * ⚠️ `save` escribe los TRES niveles juntos, así que hay que partir de lo que hay GUARDADO, no de lo que se
   * ve: si la lectura falló, en pantalla están los de serie y guardar rebajaría los otros dos sin avisar. Por
   * eso se espera la lectura (o se reintenta), y si tampoco se puede leer, no se escribe nada.
   */
  const pick = async (kind: keyof CompressionLevels, level: CompressionLevel) => {
    const prev = levels[kind];
    picked.current = true;
    setLevels(l => ({ ...l, [kind]: level }));
    setErr(null);
    try {
      let base = guardado.current ?? (await lectura.current) ?? null;
      if (!base) base = (await compressionLevels.load()) ?? DEFAULT_COMPRESSION_LEVELS;
      const next = { ...base, [kind]: level };
      await compressionLevels.save(next);
      guardado.current = next;
      setLevels(next);
    } catch {
      setLevels(l => ({ ...l, [kind]: prev }));
      setErr(t('admin.compression.saveError'));
    }
  };

  return (
    <div>
      <div className="rv-page-title">{t('admin.settingsTitle')}</div>
      <div className="rv-admin-tabs" role="tablist" aria-label={t('admin.settingsTitle')}>
        {TABS.map(x => (
          <button key={x.id} type="button" role="tab" id={`${uid}-tab-${x.id}`} aria-controls={`${uid}-panel-${x.id}`}
            aria-selected={tab === x.id} className={`rv-admin-tab ${tab === x.id ? 'active' : ''}`} onClick={() => setTab(x.id)}>
            {t(x.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'images' && (
        <div role="tabpanel" id={`${uid}-panel-images`} aria-labelledby={`${uid}-tab-images`}>
          <Card padding={24}>
            <h3 className="rv-section-title">{t('admin.compression.title')}</h3>
            <p className="rv-page-sub">{t('admin.compression.hint')}</p>
            {KINDS.map(kind => (
              <div key={kind} className="rv-field">
                <span className="rv-label">{t(`admin.compression.${kind}`)}</span>
                <div className="rv-seg" role="radiogroup" aria-label={t(`admin.compression.${kind}`)}>
                  {LEVELS.map(level => (
                    <button key={level} type="button" role="radio" aria-checked={levels[kind] === level}
                      className={`rv-seg-btn ${levels[kind] === level ? 'active' : ''}`} onClick={() => void pick(kind, level)}>
                      {t(`admin.compression.level.${level}`)}
                    </button>
                  ))}
                </div>
                {kind === 'background' && <span className="rv-hint">{t('admin.compression.backgroundNote')}</span>}
              </div>
            ))}
            {err && <span className="rv-err" role="alert">{err}</span>}
            <span className="rv-hint">{t('admin.compression.saveNote')}</span>
          </Card>
        </div>
      )}
    </div>
  );
}
