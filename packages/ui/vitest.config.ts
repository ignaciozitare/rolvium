import { defineConfig } from 'vitest/config';
// `node` basta: el compresor recibe por parámetro lo que necesita del navegador (canvas), justo para
// poder probarlo sin uno. Si algún día se prueban componentes React aquí, hará falta `jsdom`.
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
