import type { VisualTheme } from '@rolvium/core';

/** Values mirror rolvium.pen `pl-*` variables. Applied as `--sys-*` on the table container. */
export const theme: VisualTheme = {
  vars: {
    'bg': '#b9b7ac', 'paper': '#dedcd5', 'paper-hi': '#efede7', 'paper-lo': '#cbc9c0',
    'border': '#949288', 'line': '#8a887e', 'ink': '#131310', 'ink-soft': '#221f19',
    // `ink-dim` daba 4,52:1 sobre el papel y se usa en los textos pequenos; #55534c lo subio a 5,61:1.
    // Y aun asi seguia leyendose flojo EN PANTALLA (dueno, 2026-08-20: «oscurece todas las letras,
    // todavia tienen poco cuerpo y son muy claras»). El motivo es la letra, no el color: Cormorant
    // Garamond es una romana de trazo fino, asi que a 10–11 px un gris medio se deshace aunque el
    // contraste medido sea correcto. Los dos tonos bajan un escalon — `ink-soft` #39382f → #221f19
    // (8,49:1 → 13,1:1) y `ink-dim` #55534c → #3b382f (5,61:1 → 9,5:1)— y los textos pequenos suben
    // de peso 400 a 500. El contraste solo puede mejorar bajando, asi que esto no rompe nada medido.
    // ⚠ Pendiente y NO resuelto aqui: `gold` sobre `ink` da 3,95:1 y ese par ya esta en pantalla
    // (`.rv-sheet-btn.gold`, `.rv-sheet-icon-btn`, `maps.css`). Hace falta un dorado para fondo
    // oscuro (#c9a44e da 7,89:1), pero entra con sus consumidores, no antes: un token de tema que
    // no usa nadie es una promesa con fecha de caducidad. Ojo, seria SOLO para fondo oscuro —
    // sobre `paper` da 1,72:1. Anotado en WORK_STATE.
    'ink-dim': '#3b382f',
    'steel': '#4a5757', 'olive': '#3a3a26', 'blood': '#6e2418', 'gold': '#8a7038',
    'card': '#f2f0ea80', 'moon-hi': '#a8a69b', 'moon-mid': '#5a594e', 'moon-lo': '#15140e', 'card-shadow': '0 3px 10px #13131040',
    'font-display': "'Cormorant Garamond', Georgia, serif", 'font-body': "'Cormorant Garamond', Georgia, serif",
  },
  fonts: { display: 'Cormorant Garamond', body: 'Cormorant Garamond', url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap' },
  backgroundImage: '/systems/plenilunio/fondo.png',
  icons: { stat: 'crescent', health: 'moon-phase' },
};
