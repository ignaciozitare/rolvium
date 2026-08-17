import type { GameSystem } from './gameSystem';

/** Metadata the platform shows before a system package is loaded (catalog, campaign wizard). */
export interface SystemInfo {
  id: string;
  version: string;
  nameKey: string;
  publisher?: string;
  installed: boolean;
  /** Lazy loader of the full package (code-split). Absent when not installed. */
  load?: () => Promise<GameSystem>;
}

/** Simple registry; the web app fills it at boot (`systems/registry.ts`). */
export function createSystemRegistry(list: SystemInfo[]) {
  const byId = new Map(list.map(s => [s.id, s] as const));
  return {
    all: () => list,
    get: (id: string) => byId.get(id) ?? null,
    async load(id: string): Promise<GameSystem> {
      const s = byId.get(id);
      if (!s?.load) throw new Error(`system_not_installed:${id}`);
      return s.load();
    },
  };
}
export type SystemRegistry = ReturnType<typeof createSystemRegistry>;
