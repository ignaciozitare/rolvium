import type { ReactNode } from 'react';
import { useTranslation } from '@rolvium/i18n';
import { Btn, EmptyState, ErrorBoundary } from '@rolvium/ui';

/**
 * LA RED, YA VESTIDA: envuelve un trozo de pantalla para que, si revienta al pintarse, se caiga SÓLO ese
 * trozo. Ver `specs/core/errors/SPEC.md` y `rolvium.pen` § 11 (láminas «Error/La pantalla se ha roto» y
 * «Mesa/Un trozo se ha roto», aprobadas por él el 2026-09-17).
 *
 * El comportamiento vive en `ErrorBoundary` (`@rolvium/ui`), que no sabe de traducciones. Esto es lo que le
 * pone los textos y el aspecto — y por eso vive aquí y no en el paquete compartido.
 */
export function SafeRegion({ children, label, variant = 'region' }: {
  children: ReactNode;
  /** Qué trozo es. Sale en la consola para saber cuál se cayó. */
  label: string;
  /** `page` es el último recurso —la pantalla entera— y por eso añade el botón de recargar. */
  variant?: 'region' | 'page';
}): JSX.Element {
  const { t } = useTranslation();
  const esPagina = variant === 'page';
  return (
    <ErrorBoundary
      label={label}
      fallback={reintentar => (
        <div
          data-testid="safe-region-fallback"
          role="alert"
          style={esPagina
            ? { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }
            : { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
        >
          <EmptyState
            /* Ámbar y no rojo: no es culpa suya y no se pierde nada. El rojo aquí es «has hecho algo mal». */
            tone="amber"
            icon="warning"
            title={t(esPagina ? 'errors.pageTitle' : 'errors.regionTitle')}
            description={t(esPagina ? 'errors.pageDescription' : 'errors.regionDescription')}
            actions={
              <>
                <Btn variant="primary" onClick={reintentar}>{t('errors.retry')}</Btn>
                {/* Recargar sólo en el último recurso: dentro de la mesa tiraría la partida entera por un trozo. */}
                {esPagina && <Btn variant="ghost" onClick={() => window.location.reload()}>{t('errors.reload')}</Btn>}
              </>
            }
          />
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
