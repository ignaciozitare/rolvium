import { useTranslation } from '@rolvium/i18n';
import { Tooltip } from '@rolvium/ui';
import type { Scene } from '../domain/entities/Scene';
import { nightLabelM } from '../domain/useCases/mapRules';

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  isDm: boolean;
  showWalls: boolean;
  onToggleWalls: () => void;
  playerView: boolean;
  onTogglePlayerView: () => void;
  /** DM scene switches that used to sit on a full-width bar under the canvas. */
  scene?: Scene;
  onFogMode?: (mode: 'vision' | 'manual') => void;
  onLighting?: (lighting: 'day' | 'night') => void;
  /** Paredes sólidas: si los tokens atraviesan los muros en esta escena (rebanada 4). */
  onSolidWalls?: (solid: boolean) => void;
  /**
   * El VELO GRIS del director, encendido o apagado. Es SUYO y de nadie más: no toca la escena, no viaja y no
   * cambia lo que ve un jugador — es «déjame ver el mapa limpio un momento» (dueño, 2026-09-02: «al dm le
   * falta un desactivar esa capa gris para él, para que pueda ver bien»).
   */
  fogVeil?: boolean;
  onToggleFogVeil?: () => void;
  /**
   * LOS MUROS, ENSEÑADOS A LOS JUGADORES (petición suya, 2026-09-03: «agrega un botón para que los jugadores
   * puedan ver las líneas de los muros»). Encendido = TODOS los muros de la escena están visibles para ellos.
   *
   * El estado no se guarda en ninguna columna de la escena: SALE DE LOS MUROS. Es «¿están todos visibles?»,
   * que es la única verdad que hay — inventar un interruptor aparte crearía dos fuentes que se contradicen en
   * cuanto él marque un muro suelto a mano desde el panel de Builder, que es algo que ya puede hacer.
   */
  wallsToPlayers?: boolean;
  onWallsToPlayers?: (visible: boolean) => void;
}

/**
 * El nombre sale en un `Tooltip`, NO en el `title` del navegador: el nativo tarda casi un segundo, cae donde
 * quiere y no sigue el look del sistema, así que estos botones eran ocho iconos sin nombre (dueño, 2026-09-01:
 * «no me entero con los botones que hay»). Va a la IZQUIERDA porque la pila vive pegada al borde derecho.
 */
function Ctl({ icon, label, onClick, on }: { icon: string; label: string; onClick: () => void; on?: boolean }): JSX.Element {
  return (
    <Tooltip label={label} placement="left">
      <button type="button" className={`mp-ctl ${on ? 'on' : ''}`} aria-label={label} aria-pressed={on} onClick={onClick}>
        {/*
          * Un icono que empieza por `/` es un DIBUJO nuestro y no un Material Symbol, igual que en la barra de
          * herramientas. Va de MÁSCARA y no de `<img>` porque el color lo pone el botón: encendido, el fondo es
          * negro y el dibujo tiene que salir en papel — con un `<img>` se quedaría negro sobre negro.
          */}
        {icon.startsWith('/')
          ? <span className="mp-tool-img" data-testid="mp-ctl-img" style={{ maskImage: `url(${icon})`, WebkitMaskImage: `url(${icon})` }} />
          : <span className="material-symbols-outlined" style={{ fontSize: 'var(--icon-sm)' }}>{icon}</span>}
      </button>
    </Tooltip>
  );
}

/**
 * Bottom-right stack over the canvas: zoom in/out/centre, and for the DM the walls toggle, «ver como jugador» and —
 * above those — the two scene switches, light and automatic fog. They were a full-width bar under the map; as icons
 * here they cost no height, which is the whole point (specs/modules/maps/SPEC.md § «Rebanada 3»).
 */
export function CanvasControls(p: Props): JSX.Element {
  const { t } = useTranslation();
  const night = p.scene?.lighting === 'night';
  const auto = p.scene?.fogMode === 'vision';
  return (
    <div className="mp-controls" role="group" aria-label={t('maps.controls.label')}>
      {p.isDm && p.scene && p.onLighting && (
        <Ctl icon={night ? 'dark_mode' : 'light_mode'} on={night}
          label={night ? t('maps.light.night', { m: nightLabelM(p.scene) }) : t('maps.light.day')}
          onClick={() => p.onLighting?.(night ? 'day' : 'night')} />
      )}
      {/*
        * Paredes sólidas, junto a la luz y la niebla porque es de la misma familia: un ajuste de ESTA escena
        * que pone el director y que cambia lo que puede hacer el jugador. Se dice si está encendido o apagado
        * en la etiqueta, y no sólo con el icono, porque de un icono no se deduce qué pasa al pulsarlo.
        */}
      {p.isDm && p.scene && p.onSolidWalls && (
        <Ctl icon={p.scene.solidWalls ? 'shield' : 'shield_moon'} on={p.scene.solidWalls}
          label={p.scene.solidWalls ? t('maps.solidWalls.on') : t('maps.solidWalls.off')}
          onClick={() => p.onSolidWalls?.(!p.scene!.solidWalls)} />
      )}
      {/*
        * La niebla, con la MISMA regla que las paredes sólidas de arriba: la etiqueta dice en qué estado está
        * y qué pasa al pulsar. Decía «Niebla automática por visión» en los DOS estados, y de ahí salió el fallo
        * del 2026-09-03: las dos escenas de producción acabaron en `manual` sin que el dueño lo notara, y en
        * manual el servidor no calcula visión (`sceneVision.ts`, `vision: []`), así que el mapa se quedaba
        * entero tapado y no se abría — parecía que la niebla dinámica estuviera rota, y sólo estaba apagada.
        */}
      {p.isDm && p.scene && p.onFogMode && (
        <Ctl icon={auto ? 'cloud' : 'cloud_off'} on={auto} label={auto ? t('maps.fog.autoOn') : t('maps.fog.autoOff')}
          onClick={() => p.onFogMode?.(auto ? 'manual' : 'vision')} />
      )}
      {/*
        * ENSEÑARLE LOS MUROS A LOS JUGADORES, todos de golpe. Va aquí, con la luz, las paredes sólidas y la
        * niebla, porque es de su misma familia: un ajuste de ESTA escena que pone el director y que cambia lo
        * que ve el jugador. El velo de abajo ya no lo es —ése sólo le afecta a él—, y por eso queda después.
        *
        * El icono es un DIBUJO nuestro, no un Material Symbol: él pidió una pared, «cuando se ven los muros
        * que se vean los ladrillos y cuando no, la pared dibujada con puntos» (2026-09-03), y ese par no
        * existe en Material. Las dos mitades son LA MISMA pared —mismo contorno, mismas hiladas, mismas
        * juntas—, que es lo que hace que se lean como el mismo botón encendido y apagado.
        */}
      {p.isDm && p.onWallsToPlayers && (
        <Ctl icon={p.wallsToPlayers ? '/icons/wall-bricks.svg' : '/icons/wall-dotted.svg'} on={p.wallsToPlayers}
          label={p.wallsToPlayers ? t('maps.wallsToPlayers.on') : t('maps.wallsToPlayers.off')}
          onClick={() => p.onWallsToPlayers?.(!p.wallsToPlayers)} />
      )}
      {/*
        * Quitarse el velo gris. Va JUNTO a la niebla porque es de lo que habla, pero no es lo mismo y por eso
        * lo dice la etiqueta: la niebla de al lado cambia LA ESCENA para todos; esto sólo cambia lo que ve él
        * en su pantalla, ahora mismo. Nada de esto se guarda ni viaja.
        */}
      {p.isDm && p.onToggleFogVeil && (
        <Ctl icon={p.fogVeil === false ? 'filter_drama' : 'foggy'} on={p.fogVeil !== false}
          label={p.fogVeil === false ? t('maps.fog.veilOff') : t('maps.fog.veilOn')} onClick={p.onToggleFogVeil} />
      )}
      {p.isDm && <span className="mp-ctl-sep" aria-hidden />}
      <Ctl icon="zoom_in" label={t('maps.controls.zoomIn')} onClick={p.onZoomIn} />
      <Ctl icon="zoom_out" label={t('maps.controls.zoomOut')} onClick={p.onZoomOut} />
      <Ctl icon="center_focus_strong" label={t('maps.controls.center')} onClick={p.onCenter} />
      {p.isDm && <Ctl icon={p.showWalls ? 'visibility' : 'visibility_off'} label={t('maps.controls.walls')} onClick={p.onToggleWalls} on={p.showWalls} />}
      {/*
        * «Ver como jugador» ES la sonda de prueba (§ 7.3): al encenderlo se le quitan al director sus
        * privilegios Y aparece en el mapa una ficha genérica que él arrastra para ver qué se vería desde ahí.
        *
        * El icono es `theater_comedy` —las máscaras del teatro, «ponerse en el papel de otro»— y lo eligió el
        * dueño el 2026-09-01 entre tres candidatos dibujados en `rolvium.pen`. Antes era `layers`, que no
        * decía nada («no se entiende el icono, busquemos otro»), y además chocaba con el panel de capas.
        */}
      {p.isDm && <Ctl icon="theater_comedy" label={t('maps.controls.playerView')} onClick={p.onTogglePlayerView} on={p.playerView} />}
    </div>
  );
}
