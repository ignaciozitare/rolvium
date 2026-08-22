import { supabase } from '@/shared/lib/supabaseClient';
import { HttpRollsAdapter } from './infra/HttpRollsAdapter';
import { HttpAttacksAdapter } from './infra/HttpAttacksAdapter';
import { HttpRollRequestsAdapter } from './infra/HttpRollRequestsAdapter';
import { SupabaseRollLogRepo } from './infra/SupabaseRollLogRepo';
import { SupabaseAttackWatchRepo } from './infra/SupabaseAttackWatchRepo';
import { SupabaseRollRequestWatchRepo } from './infra/SupabaseRollRequestWatchRepo';
import type { RollsPort } from './domain/ports/RollsPort';
import type { RollLogPort } from './domain/ports/RollLogPort';
import type { AttacksPort } from './domain/ports/AttacksPort';
import type { RollRequestsPort } from './domain/ports/RollRequestsPort';
import type { AttackWatchPort } from './domain/ports/AttackWatchPort';
import type { RollRequestWatchPort } from './domain/ports/RollRequestWatchPort';

/** Rolls go through the API (`POST /rolls`: server dice, immutable log, sheet effects). */
export const rollsPort: RollsPort = new HttpRollsAdapter();
/** The Registro reads `dice_rolls` under RLS and follows inserts live. */
export const rollLog: RollLogPort = new SupabaseRollLogRepo(supabase);
/** Abrir un ataque cuerpo a cuerpo y contestarlo: también por la API, que es quien tira. */
export const attacksPort: AttacksPort = new HttpAttacksAdapter();
export const rollRequestsPort: RollRequestsPort = new HttpRollRequestsAdapter();
/** El aviso de «te atacan» lee `dice_attacks` bajo RLS y la sigue en vivo. */
export const attackWatch: AttackWatchPort = new SupabaseAttackWatchRepo(supabase);
export const rollRequestWatch: RollRequestWatchPort = new SupabaseRollRequestWatchRepo(supabase);
