import { supabase } from '@/shared/lib/supabaseClient';
import { HttpRollsAdapter } from './infra/HttpRollsAdapter';
import { HttpAttacksAdapter } from './infra/HttpAttacksAdapter';
import { SupabaseRollLogRepo } from './infra/SupabaseRollLogRepo';
import { SupabaseAttackWatchRepo } from './infra/SupabaseAttackWatchRepo';
import type { RollsPort } from './domain/ports/RollsPort';
import type { RollLogPort } from './domain/ports/RollLogPort';
import type { AttacksPort } from './domain/ports/AttacksPort';
import type { AttackWatchPort } from './domain/ports/AttackWatchPort';

/** Rolls go through the API (`POST /rolls`: server dice, immutable log, sheet effects). */
export const rollsPort: RollsPort = new HttpRollsAdapter();
/** The Registro reads `dice_rolls` under RLS and follows inserts live. */
export const rollLog: RollLogPort = new SupabaseRollLogRepo(supabase);
/** Abrir un ataque cuerpo a cuerpo y contestarlo: también por la API, que es quien tira. */
export const attacksPort: AttacksPort = new HttpAttacksAdapter();
/** El aviso de «te atacan» lee `dice_attacks` bajo RLS y la sigue en vivo. */
export const attackWatch: AttackWatchPort = new SupabaseAttackWatchRepo(supabase);
