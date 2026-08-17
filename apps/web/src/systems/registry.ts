import { createSystemRegistry, type SystemInfo } from '@rolvium/core';

/**
 * Game systems known to this build. `installed` ones expose a lazy loader of
 * the full package (code-split). Adding a system = one entry here.
 */
export const SYSTEMS: SystemInfo[] = [
  { id: 'plenilunio', version: '0.1.0', nameKey: 'systems.plenilunio.name', publisher: 'NoSoloRol', installed: true,
    load: () => import('@rolvium/system-plenilunio').then(m => m.plenilunio) },
  { id: 'cyberpunk', version: '0.0.0', nameKey: 'systems.cyberpunk.name', publisher: 'R. Talsorian', installed: false },
  { id: 'dnd5e',     version: '0.0.0', nameKey: 'systems.dnd5e.name',     publisher: 'SRD 5.1',       installed: false },
];

export const systemRegistry = createSystemRegistry(SYSTEMS);
