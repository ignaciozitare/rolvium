import type { RollRequest, RollResult, RollVisibility, RolledDice } from '@rolvium/core';

/** One row of `dice_rolls` as the Registro shows it (author joined from `users`). */
export interface Roll {
  id: string;
  campaignId: string;
  characterId: string | null;
  /**
   * Quién tiró, en la ficción: el nombre del PERSONAJE, no el de la cuenta («Karen Sinclair», no
   * «Game Master Root»). `null` cuando la tirada no sale de una ficha (libre, criatura) o cuando la
   * RLS no me deja ver ese personaje — en cuyo caso el Registro enseña sólo el título, como siempre.
   */
  characterName: string | null;
  authorId: string;
  authorName: string | null;
  authorAvatarUrl: string | null;
  systemId: string | null;
  kind: 'system' | 'free';
  title: string;
  request: RollRequest;
  dice: RolledDice;
  result: RollResult;
  visibility: RollVisibility;
  correctsId: string | null;
  createdAt: string;
}

/** What `POST /rolls` returns: the committed roll plus, for character rolls with effects, whether the API applied them. */
export interface RollOutcome {
  id: string;
  request: RollRequest;
  dice: RolledDice;
  result: RollResult;
  rolledAt: string;
  effectsApplied?: boolean;
  sheet?: { derived: Record<string, unknown>; health: string | null };
}
