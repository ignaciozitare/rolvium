import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Lo mismo que `apps/web/tests/setup.ts`: sin esto, lo montado en un test sigue en el DOM en el siguiente.
afterEach(() => { cleanup(); });
