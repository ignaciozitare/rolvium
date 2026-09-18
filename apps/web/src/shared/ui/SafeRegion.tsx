import type { ReactNode } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, EmptyState, ErrorBoundary } from '@rolvium/ui';
import './safe-region.css';

/**
 * LA RED, YA VESTIDA: envuelve un trozo de pantalla para que, si revienta al pintarse, se caiga SÓLO ese
 * trozo. Ver `specs/core/errors/SPEC.md` y `rolvium.pen` § 11.
 *
 * El comportamiento vive en `ErrorBoundary` (`@rolvium/ui`), que no sabe de traducciones. Esto es lo que le
 * pone los textos y el aspecto — y por eso vive aquí y no en el paquete compartido.
 *
 * 🔑 **DOS TRAJES, Y NO ES UN CAPRICHO** (lo cazó la review, 2026-09-17). Las cuatro costuras de dentro de la
 * mesa se montan sobre el tablero, que es casi negro SIEMPRE, y ahí los colores de la app (`--tx`, `--sf`…)
 * dan 1,12:1 de contraste con el tema claro puesto: el aviso saldría **invisible**, y él concluiría que la
 * red no funciona justo en la pantalla que existe para enseñársela. Dentro de la mesa manda `--sys-*`, que es
 * lo que dice `table.css` y lo que dibuja la lámina «Mesa/Un trozo se ha roto».
 */
export function SafeRegion({ children, label, variant = 'region' }: {
  children: ReactNode;
  /** Qué trozo es. Sale en la consola para saber cuál se cayó. */
  label: string;
  /** `page` es el último recurso —la pantalla entera, con el cromo de la app— y añade el botón de recargar. */
  variant?: 'region' | 'page';
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <ErrorBoundary
      label={label}
      fallback={reintentar => (
        <div data-testid="safe-region-fallback" role="alert" className={`rv-safe rv-safe-${variant}`}>
          {variant === 'page'
            ? (
              <EmptyState
                /* Ámbar y no rojo: no es culpa suya y no se pierde nada. El rojo aquí es «has hecho algo mal». */
                tone="amber"
                icon="warning"
                title={t('errors.pageTitle')}
                description={t('errors.pageDescription')}
                actions={
                  <>
                    <Btn variant="primary" onClick={reintentar}>{t('errors.retry')}</Btn>
                    <Btn variant="ghost" onClick={() => window.location.reload()}>{t('errors.reload')}</Btn>
                  </>
                }
              />
            )
            : (
              /*
               * LA TARJETA DE PAPEL DE LA MESA, 1:1 con la lámina. Nada de `EmptyState` aquí: ese componente
               * es del cromo de la app por diseño y sus colores no se leen sobre el tablero.
               */
              <div className="rv-safe-card">
                <span className="material-symbols-outlined rv-safe-icon" aria-hidden="true">warning</span>
                <h3 className="rv-safe-title">{t('errors.regionTitle')}</h3>
                <p className="rv-safe-desc">{t('errors.regionDescription')}</p>
                {/*
                  * EN ROJO SANGRE, no en oro. Es su regla de siempre —«en la mesa lo activo va en sangre»— y
                  * manda sobre la lámina: la que copié heredó el oro de «Mesa/Reserva vacía». El `.pen` se
                  * corrige para que no quede diciendo lo contrario.
                  *
                  * Y aquí NO se ofrece recargar: dentro de la mesa tiraría la partida entera por un trozo.
                  */}
                <button type="button" className="rv-safe-cta" onClick={reintentar}>{t('errors.retry')}</button>
              </div>
            )}
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
