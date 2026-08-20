import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@rolvium/i18n';
import type { GameSystem } from '@rolvium/core';
import { sysT } from '@/modules/characters/domain/useCases/systemText';
import { bestiaryRepo } from '../container';
import type { BestiaryPort } from '../domain/ports/BestiaryPort';
import type { BestiaryEntry, BestiaryEntryPatch, NewBestiaryEntry, OriginFilter } from '../domain/entities/BestiaryEntry';
import { byOrigin, duplicateOf, fromCatalog, mergeEntries } from '../domain/useCases/bestiaryRules';
import { filterEntries } from '@/modules/maps/domain/useCases/mapRules';

interface Options { campaignId: string; system: GameSystem; repo?: BestiaryPort }

/**
 * El listado del Bestiario: une los bloques del manual (datos del sistema, sin fila) con las entradas propias
 * del director (de la base). Traduce las del manual aquí, porque el dominio no traduce.
 */
export function useBestiary({ campaignId, system, repo = bestiaryRepo }: Options) {
  const { locale } = useTranslation();
  const ts = useMemo(() => sysT(system, locale), [system, locale]);

  const [own, setOwn] = useState<BestiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OriginFilter>('all');
  const [query, setQuery] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOwn(await repo.listForCampaign(campaignId, system.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [campaignId, system.id, repo]);

  useEffect(() => { void reload(); }, [reload]);

  /** Las 45 del manual, con nombre y notas ya en el idioma del usuario. */
  const manual = useMemo(
    () => (system.catalogs['bestiary'] ?? []).map(item => fromCatalog(item, ts(item.label), ts(String(item.data?.notes ?? '')))),
    [system, ts],
  );

  const all = useMemo(() => mergeEntries(manual, own), [manual, own]);
  const visible = useMemo(() => filterEntries(byOrigin(all, filter), query, e => e.name), [all, filter, query]);

  /**
   * El nombre de una especialidad. Las que comparte con los jugadores llegan como `combate.armasCortas` y viven
   * en `specialties`; las propias de criatura como `creature.garrote` y viven en `creatureSpecialties`. Si una no
   * resuelve se devuelve su id en crudo: mejor un id feo en pantalla que una celda vacía sin explicación.
   */
  const specialtyLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const key of ['specialties', 'creatureSpecialties'] as const)
      for (const item of system.catalogs[key] ?? []) map.set(item.id, item.label);
    return (id: string): string => { const k = map.get(id); return k ? ts(k) : id; };
  }, [system, ts]);

  const counts = useMemo(() => ({
    all: all.length,
    manual: manual.length,
    custom: own.filter(e => e.origin === 'custom').length,
    npc: own.filter(e => e.origin === 'npc').length,
  }), [all, manual, own]);

  // Todas las escrituras recargan: la lista es corta y así no hay dos verdades sobre lo que hay guardado.
  const create = useCallback(async (input: NewBestiaryEntry) => { const e = await repo.create(input); await reload(); return e; }, [repo, reload]);
  const update = useCallback(async (id: string, patch: BestiaryEntryPatch) => { const e = await repo.update(id, patch); await reload(); return e; }, [repo, reload]);
  const remove = useCallback(async (id: string) => { await repo.remove(id); await reload(); }, [repo, reload]);

  /** Duplicar sirve tanto para «otro mutante» como para poder editar un bloque del manual sin tocarlo. */
  const duplicate = useCallback(
    (entry: BestiaryEntry, campaignScoped = true) => create(duplicateOf(entry, all, campaignScoped ? campaignId : null, system.id)),
    [create, all, campaignId, system.id],
  );

  return { entries: all, visible, counts, loading, error, filter, setFilter, query, setQuery, reload, create, update, remove, duplicate, repo, ts, specialtyLabel };
}
