import type { VisualTheme } from '@rolvium/core';

/** Values mirror rolvium.pen `pl-*` variables. Applied as `--sys-*` on the table container. */
export const theme: VisualTheme = {
  vars: {
    'bg': '#b9b7ac', 'paper': '#dedcd5', 'paper-hi': '#efede7', 'paper-lo': '#cbc9c0',
    'border': '#949288', 'line': '#8a887e', 'ink': '#131310', 'ink-soft': '#39382f', 'ink-dim': '#63615a',
    'steel': '#4a5757', 'olive': '#3a3a26', 'blood': '#6e2418', 'gold': '#8a7038',
    'card': '#f2f0ea80', 'moon-hi': '#a8a69b', 'moon-mid': '#5a594e', 'moon-lo': '#15140e', 'card-shadow': '0 3px 10px #13131040',
    'font-display': "'Cormorant Garamond', Georgia, serif", 'font-body': "'Cormorant Garamond', Georgia, serif",
  },
  fonts: { display: 'Cormorant Garamond', body: 'Cormorant Garamond', url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&display=swap' },
  backgroundImage: '/systems/plenilunio/fondo.png',
  icons: { stat: 'crescent', health: 'moon-phase' },
};
