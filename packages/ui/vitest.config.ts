import { defineConfig } from 'vitest/config';
/*
 * `jsdom` desde el 2026-09-17, que es el día que anticipaba el comentario que había aquí: el primer
 * componente de React que se prueba en este paquete es `ErrorBoundary`, y una red de errores de render sin
 * un DOM no se puede probar. Las pruebas que NO son de componente (`compressImage`) siguen igual: no usan el
 * DOM, y `jsdom` no les cambia nada.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
