/** Pure rules of the generator wizard that are the platform's, not the system's. */

/**
 * Whether a budget-guarded edit may land, given the step's remaining points before and after it.
 *
 * Two escapes from a dead end, both learned from the owner using it:
 * - `after >= 0` — the ordinary case: you can afford it.
 * - `after >= before` — an overspent step must still let you REPAIR it. A step can be left
 *   overspent by another one (Plenilunio's gift trades spend creation points, and lowering
 *   Destino after picking gifts shrinks the gift-point pool), and without this every control
 *   that would fix it is refused too.
 *
 * `>=` and not `>`: an edit that leaves the budget exactly as it found it costs nothing, so
 * refusing it protects nothing. That was the bug — with the gift pool in the red you could no
 * longer change WHICH gift a row was: the select silently bounced back to its old value
 * (owner, 2026-08-19: «al elegirlo vuelve al valor anterior»).
 */
export const budgetAllows = (after: number | undefined, before: number | undefined): boolean =>
  after === undefined || after >= 0 || after >= (before ?? 0);
