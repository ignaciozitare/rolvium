import type { ExplainLine, RollExplain } from '@rolvium/core';

interface Props {
  explain: RollExplain;
  /** `aria-describedby` de la entrada, para que el teclado y el lector lleguen al desglose. */
  id: string;
  t: (key: string, params?: Record<string, string>) => string;
}

/**
 * Junta las páginas del manual de todas las líneas en «Manual · p.82 y p.96»: la coma y la «y» son
 * texto, así que salen de las locales y no del código.
 */
export function pagesLabel(lines: ExplainLine[], t: Props['t']): string | null {
  const pages = [...new Set(lines.map(l => l.page).filter((p): p is number => typeof p === 'number'))].sort((a, b) => a - b);
  if (pages.length === 0) return null;
  const labels = pages.map(n => t('dice.log.breakdown.page', { n: String(n) }));
  const last = labels[labels.length - 1] as string;
  const joined = labels.length === 1 ? last : `${labels.slice(0, -1).join(', ')} ${t('dice.log.breakdown.and')} ${last}`;
  return t('dice.log.breakdown.ref', { pages: joined });
}

/** La página de una línea, pegada al final: «… no aplicada por el director (p.83)». */
const withPage = (l: ExplainLine, t: Props['t']): string =>
  (l.page === undefined ? l.text : `${l.text} (${t('dice.log.breakdown.page', { n: String(l.page) })})`);

/**
 * El desglose de una tirada (rolvium.pen `Tooltip/Desglose`): de dónde salieron los dados, qué reglas
 * se aplicaron sin preguntar y cómo se cierra. **El texto lo escribe el SISTEMA** (`engine.explain`),
 * porque es el único que sabe qué regla entró y en qué página del manual está; esto sólo lo pinta.
 *
 * Sale al pasar por encima de la entrada, y lo abre el CSS (`:hover` / `:focus-within`): sin estado,
 * sin JS y sin nada colgando debajo del registro, que se lee de un vistazo.
 *
 * La primera línea de la cabecera NO repite su página: es la de la tirada en sí y ya encabeza el
 * «Manual · p.82 y p.96» de arriba.
 */
export function RollBreakdown({ explain, id, t }: Props): JSX.Element {
  const ref = pagesLabel([...explain.head, ...explain.applied], t);
  return (
    <div role="tooltip" id={id} className="dc-tip">
      <div className="dc-tip-head">
        <span>{t('dice.log.breakdown.title')}</span>
        {ref && <em>{ref}</em>}
      </div>
      <div className="dc-tip-block">
        {explain.head.map((l, i) => <p key={i}>{i === 0 ? l.text : withPage(l, t)}</p>)}
      </div>
      {explain.applied.length > 0 && (
        <>
          <span className="dc-tip-label">{t('dice.log.breakdown.applied')}</span>
          <div className="dc-tip-block applied">
            {explain.applied.map((l, i) => <p key={i}>{withPage(l, t)}</p>)}
          </div>
        </>
      )}
      {explain.verdict && <p className="dc-tip-verdict">{explain.verdict}</p>}
    </div>
  );
}
