import { useEffect, type CSSProperties } from 'react';
import type { GameSystem } from '@rolvium/core';

/**
 * VESTIR UNA PÁGINA CON EL PAPEL DEL SISTEMA DE JUEGO — las dos piezas que necesita cualquier pantalla que se
 * abra FUERA de la mesa y tenga que seguir pareciendo de la misma partida: la ficha aparte (`/characters/:id`)
 * y la aventura aparte (`/adventures/:id`).
 *
 * Vive en `shared` y no dentro de un módulo porque no es de nadie: hasta el 2026-09-20 estaban dentro de
 * `characters/ui/CharacterSheetPage`, y la ventana de una aventura tenía que entrar en la `ui` de otro módulo
 * para usarlas — justo lo que prohíbe `CLAUDE.md` § «La puerta de cada módulo».
 *
 * Dentro de la mesa no hay claro/oscuro: manda el tema del sistema, que entra por estas variables `--sys-*`.
 */

/** Las variables `--sys-*` de un tema, en línea (el mismo mapeo que usa la mesa). */
export function systemThemeStyle(system: GameSystem | null): CSSProperties {
  if (!system) return {};
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(system.theme.vars)) vars[`--sys-${k}`] = v;
  if (system.theme.backgroundImage) vars['--sys-bg-image'] = `url(${system.theme.backgroundImage})`;
  return vars as CSSProperties;
}

/** Carga las tipografías del sistema una sola vez (`theme.fonts.url`). */
export function useSystemFonts(system: GameSystem | null): void {
  useEffect(() => {
    const url = system?.theme.fonts?.url;
    if (!url || document.querySelector(`link[data-sys-font="${system?.id}"]`)) return;
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = url; link.dataset.sysFont = system?.id ?? ''; document.head.appendChild(link);
  }, [system]);
}
