# Dice (H6) — SPEC

> **Written to REBUILD the module from scratch**, not as a decisions diary — the nine-section template that
> `CLAUDE.md` § «Specs» mandates since 2026-09-17. English throughout; his own words and the manual's are quoted
> verbatim in Spanish, because they are the evidence for why something is the way it is.
>
> Restructured to the template on 2026-09-20, when the branch touched the side rail. **Nothing was dropped**:
> every rule, page reference, ⚠ warning and «no construido» note of the previous version is still here, moved
> into the section it belongs to.

## Purpose

Every roll in the platform: the ones the game system resolves (`engine.resolve`) and the free ones (d4–d100,
Fudge). **Generated on the server, immutable and verifiable** — nobody, not even the GM, can edit or delete one.

Around the roll itself live the three things that make a roll mean something at the table: **who asks for it**
(the GM's panel), **who answers it** (the player's notice) and **in what order** everyone acts (the combat turn
order).

**Who uses it:** every member of the campaign. The GM additionally gets restricted visibilities (`dm`,
`secret`), the panel for asking for rolls, and the creatures' side of every conflict.

## What the user can do

**Any member**
- **Roll from the sheet** — a characteristic, a weapon action, activating a gift. The UI sends the intent
  (`RollRequest` + options + shared-resource dice taken) → the API generates the dice (CSPRNG), calls
  `engine.resolve`, stores raw dice + result → Registro and chat.
- **Roll free dice** in the **floating launcher**: a draggable floating window, **not a modal** — the table
  stays usable underneath. Visibility tabs **Todos / Director / Secreta**, rows d4·d6·d8·d10·d12·d20·d100·Fudge
  × quantity 1–6 (tap = roll), a modifier, and the last roll.
- **Read the Registro** in the side rail: per roll **who rolled** (the CHARACTER's name, not the account's:
  «Karen Sinclair · Magnum .44»), the title (characteristic · specialty), own dice / resource dice (gold edge)
  vs the opposition, the score, the degree of success, the warnings (revés, +1 Destino…), and free rolls with
  their total. Any of them can be attached to the chat.
- **See how a roll came out**: hovering an entry —or reaching it with the keyboard— opens a dark panel, «CÓMO
  SALIÓ ESTA TIRADA», with where the dice came from, which rules were applied without asking and how the result
  closes, each line with its page of the manual. Nothing hangs under the entry: the log reads at a glance and
  the detail is consulted.
- **Recompute / verify any roll**, client or API, from the raw dice.

**The player**
- **Choose only what the manual lets them choose** when they roll: dice from the Destino reserve (0–5, p.88–89)
  and, for a shot, the **range** (the difficulty comes from it, p.96 — and the map measures it: with both tokens
  placed the app knows the distance, so it knows by itself whether it is melee or a shot, and the player only
  corrects it if needed).
- **Declare the target** when attacking in melee with creatures in the scene: without an eligible target there
  is no conflict to open.
- **Answer «te atacan»**: choose how many Combate dice to spend defending (0 to their Combate). What they spend
  is discounted from their next turn.
- **Get ahead in the turn order** paying **1 Fortuna** (p.89 use 5, p.92); the new position stays for the rest
  of the combat.

**The GM**
- **Ask for a roll**: mark **who** (several at once, or «A TODOS»), then **hold a characteristic down** and drop
  on the difficulty. **No confirm button.**
- **Decide whether the specialty applies** — it is their call, not the player's (p.83).
- **Keep the scene's encounters** in a collapsible list inside the panel: add by hand, rename in the row itself,
  unfold one to see its characteristics and its other rolls, and attack from it.
- **Attack from the token** on the map: it opens that creature's attack modal and **adds to the list, it does
  not replace it**.
- **Run the combat**: open it, next turn, close it, and break ties the rules leave open.
- **Answer for their creature** when a player attacks it in melee: how many Combate dice it spends defending.

## Screens

| Screen / part | What it is | Plate |
|---|---|---|
| Floating launcher | Free dice, visibility tabs, modifier, last roll. Draggable, not modal | § 4 · `Mesa/Tiradas · rediseño — quién ve qué` (col. 1) · `PL/Lanzador flotante` |
| Roll popover (sheet) | Opens pinned to the button that rolls: dice to take, range if it is a shot | § 4 · same plate, col. 2 (`v3vfV`) |
| Registro (side rail) | One entry per roll; the breakdown opens on hover/focus | § 4 · same plate, col. 3 |
| GM panel · «LANZADOR · DIRECTOR» | The same launcher, **expanded**: ask for rolls + encounters of the scene | § 4 · same plate, col. 4 (`qHMjx` → `QWHSS`) |
| «Te ataca…» notice | The player's answer panel: how many Combate dice they spend | § 4 · same plate, col. 5 (`oSBrx` → `dcTPM`) |
| Attack from the token | The creature's attack modal, opened from the map | § 4 · same plate, col. 6 |
| Panel warnings | What the GM's panel says in each state (2026-08-22) | § 4 · `Mesa/Tiradas · avisos del panel del director` |

**What the GM's panel draws, in detail** (`v3vfV` → `qHMjx` → `QWHSS`) — head **«LANZADOR · DIRECTOR»** +
`unfold_less` icon, because it is the launcher that already exists, expanded:

- **«¿A QUIÉN LE PIDES LA TIRADA?»** · «puedes marcar varios» · a chip per character + **«A TODOS»**.
- **«MANTÉN PULSADA UNA CARACTERÍSTICA»** · «y elige la dificultad sin soltar · p.84». The seven at equal
  width, **three per row** (the seventh in the middle column). While held, the button goes ink and **the
  dropdown comes out pinned to IT, covering whatever is underneath**; the option under the finger highlights in
  **gold**. Options: `FÁCIL · 1` `MEDIA · 2` `DIFÍCIL · 3` `MUY DIFÍCIL · 5` `ÉPICA · 6`. The plate's note:
  **«Sueltas encima de la dificultad y la petición sale. Sin botón de confirmar.»**
- Checkbox **«Le vale su especialidad — lo decides tú (p.83)»**.
- **«ENCUENTROS EN LA ESCENA · N»** + **«+ AÑADIR»** + a fold arrow. Each row: token with initials, name +
  **pencil**, sub «Resistencia 30 · protección 3 · p.152», an **ATACAR** button (blood red) and an unfold arrow.
  - **Renaming happens in the row itself**: the pencil becomes a check, the name becomes a text field and **the
    line below keeps the original name** — «EL DE LA PUERTA» above, «Hambriento · Resistencia 12 · p.150» below.
    That way you still know which beast it is after nicknaming it.
  - Unfolded: the seven characteristics as **big number + small label** (`8 FOR`, `4 COM`…), a row of **«otras
    tiradas»** chips, and the note «Mantén pulsada una para elegir dificultad, igual que con los jugadores».
  - **Unfolding one closes whichever was open.**
  - **A token dropped on the map adds itself to the list.**
- Plate note: attacking from the map's token **adds to the list, does not replace it** — that is what keeps the
  panel from overflowing with ten creatures.

**The player's «te atacan» notice** (col. 5, built 2026-08-21): paper panel with a **blood fillet on the left**,
`swords` icon + **«TE ATACA UN OGRO»** in blood. Body: «Cuerpo a cuerpo con 4 dados de Combate. Es un conflicto:
los dados que pongas son tu defensa y tu ataque a la vez (p.93).» Then **«¿CUÁNTOS DADOS DE COMBATE GASTAS?»**
with chips `0…Combate` (the chosen one in ink) and «tienes Combate: 4 dados» beside it. A grey box with a
`schedule` icon and the cost, **which changes with what is chosen**. Footer: **«NO ME DEFIENDO»** (ghost) and
**«DEFENDERME · N DADOS»** (gold).

⚠ **Not drawn in the `.pen`, and therefore not to be built before being designed** (his rule, 2026-08-22:
«seguir el `.pen` AL DETALLE», what the design does not draw is not invented):
- The player's **«Tirada pedida»** notice.
- The **turn order** screen.
- **What the GM sees while waiting** for an answer — today they find out when the roll shows up in the Registro.

**No light/dark here.** Everything lives under `.tb-root`, where the game system's theme rules (`--sys-*`).

## Rules & limits

- **Rolling *as* a character**: only its owner or the GM. A member cannot register rolls against someone else's
  sheet. Attacking *as* a creature is the GM's, never a player's.
- **Immutable**: nobody (not even the GM) edits or deletes a roll. A correction is a **new roll** that
  references the previous one (`corrects_id`). A grouped roll is **two linked rolls**, never one edited.
- **Visibility**: `table` (everyone), `dm` (player → GM), `secret` (only the author; the GM sees everything).
  Enforced by RLS, not by the screen.
- **Shared resource**: the discount and the roll are **the same transaction** — no dice in hand, no roll
  (`pool_empty`). The API also rejects (403) a request that rolls more dice tagged with a shared resource than
  it declares in `sharedResources`, so the discount cannot be dodged.
- The generic engine knows `NdX`, counting successes by predicate, exploding, highest/lowest and summing; **each
  system contributes the rule**.
- **The player never chooses the difficulty of their own challenge.** p.84, literal: «Los dados de dificultad
  son **lanzados por el director de juego**». And **nothing is rolled into the void**: p.82, every action is an
  **opposed roll** — difficulty if it is a challenge, the rival's characteristic if it is a conflict.
- **The Registro does not label** whether the right-hand group is a difficulty or a rival. It is a rule of the
  book, not an oversight — p.85, literal: «Como todas las acciones requieren tiradas opuestas, Luis **no sabe**
  si el director de juego tira los dados porque hay otro personaje o porque es la dificultad de la acción».
- **The breakdown is written by the SYSTEM, not by the platform** (`Engine.explain`, optional): only it knows
  which rule applied and on what page. A system that does not declare it simply shows no breakdown.
- **The breakdown is read off the stored roll, never off today's sheet.** A roll is immutable and its breakdown
  has to say the same thing a month later, with the character healed and wearing other armour: that is why
  `engine.resolve` copies into `result.detail` what the sheet knew at roll time (the characteristic's value, its
  specialties, the wound penalty, the health state, the armour worn). When those fields are missing —old rolls,
  or rolls resolved without a sheet, like a creature's— the breakdown **stays silent** on those lines instead of
  inventing a number.
- **The name of who rolled is the CHARACTER's**, joined from `characters`. If RLS will not show me that
  character, the entry is left without a name; it **never falls back to the user's**, which says nothing about
  who acted.
- **What the sheet already knows, it applies without asking**: wound penalty (−1 die hurt, −2 badly hurt, p.99),
  armour (if any failure comes up it turns as many triumphs into normal successes as its penalty, p.98 — ⚠ it
  does **not** remove dice, an error that had to be corrected in the design), ammunition (shooting spends one
  round; with no bullets the button is off, p.97) and the weapon bonus (melee only, p.96).
- **The player does not choose how many dice they roll**: they are their characteristic's (p.82). They only
  choose reserve dice and, in combat, how they split their Combate dice.
- **Melee is a conflict** (p.93): the defender acts in the attacker's turn (p.92) and their defence spends dice
  from their next turn (p.94). **Ranged is a challenge** against the range's difficulty (p.96) — no notice, no
  defence dice.
- **A creature against the environment is a challenge and carries a difficulty; against a player it is a
  conflict and carries none** — the other side's dice are put there by the player when they defend, so the
  dropdown must not appear.
- **If the player does not answer, the roll waits indefinitely.** Nobody resolves it for them, not even the GM
  (his decision, 2026-08-20). That is why the notice **cannot be dismissed**: no X, no Escape, no click outside.
- **One notice at a time, oldest first.** If an attack and a roll request are both waiting, **the attack covers
  the request** (being hit outranks being asked); once answered, the request appears. Today that comes out of
  the mounting order in `TablePage` — if another order is ever wanted, that is where it lives.
- **Turn order** (p.92–93): **Destino descending**. Tie → **PC before NPC**; among PCs → **higher Combate**; if
  it still holds, **the GM decides** (the app asks which goes first). ⚠ Read the literal carefully: the Combate
  tiebreak is **only between PCs** — two creatures with the same Destino go straight to «the GM decides». The GM
  **does not reorder by hand**: the power the book gives them is breaking ties, and only that.
- Everyone enters their turn with their Combate dice **minus what they spent defending**. Dice can only be
  borrowed from the **next** turn, never further (p.94, literal).
- A combat **lives in a scene** — like the encounters — and only one can be active per scene.

## States & errors

| State | When | What is seen |
|---|---|---|
| Waiting for an answer | The GM attacked a PC in melee | The player gets a notice that cannot be dismissed; the GM sees nothing until the roll lands in the Registro (⚠ undesigned) |
| Silence | The player never answers | The request waits **indefinitely**; `defence_dice` `NULL` is silence, `0` is «no me defiendo» — not the same thing |
| No dice in the pool | A roll claims resource dice that are not in hand | The roll fails with `pool_empty`; nothing is discounted |
| Over-claiming resource dice | The request declares fewer than it rolls | The API answers **403** |
| Roll failed after answering | The API could not close it | The attack row **stays pending** and the player can answer again, instead of being left with a dead attack in front of them |
| Two answers at the exact same time | Race between two clients | ⚠ It would roll twice. Deliberate price: an extra roll is visible in the Registro and corrupts nothing; being unable to answer is invisible and unfixable |
| Undecided turn order | Ties the book does not resolve | `POST /combats` answers **409 UNDECIDED** with the tied groups. Not a caller error: it is the end of the rule, and the app has to ask the GM and resend the answer in `tiebreak`. A group counts as resolved only if the tiebreak names **all** of its members |
| Old roll, or one without a sheet | The breakdown has no `result.detail` | Those lines are **silent**; no number is invented |
| Unknown character | RLS hides the character of an entry | The entry has no name — it never falls back to the account's |
| 3D dice fail to load | The optional library did not arrive | The roll resolves all the same and only the animation is lost |

## Permissions

| Action | Who | How it is enforced |
|---|---|---|
| Read a `table` roll | Any member of the campaign | RLS on `dice_rolls` |
| Read a `dm` roll | Its author and the GM | RLS |
| Read a `secret` roll | Its author (and the GM) | RLS |
| Write a roll | **Nobody, from the browser** | Inserted only by the API through `dice_commit_roll` (service role), which checks membership and discounts the pool in the same transaction |
| Edit / delete a roll | **Nobody, GM included** | A trigger blocks UPDATE/DELETE; only FK actions pass |
| Roll as a character | Its owner or the GM | Checked in the API |
| Open / answer an attack | GM (open), the attacked character's owner (answer) | `dice_open_attack` / `dice_answer_attack`, SECURITY DEFINER, API-only |
| See a pending attack | The GM and the attacked character's owner | RLS. Other players find out through the roll in the Registro |
| Ask for a roll / close the request | The GM | API-only; the player answers **by rolling** |
| Open / advance / close a combat | The GM; `advance` the slot's owner | API-only (`service_role`), guards both in the use case and in SQL |

**Nothing about visibility is decided in the browser.** The Realtime channel (`postgres_changes` on
`dice_rolls`) only delivers what RLS allows.

## Data model

**`dice_rolls`** — one row per roll, system or free: campaign, character (optional), author, system, kind,
title, the intent (`request`), the **raw dice generated by the server** (`dice`), the engine's result
(`result`), visibility `table`|`dm`|`secret`, `corrects_id`, timestamp. Immutable (see § Permissions). Effects
of a roll on the sheet (`result.effects.patch`, e.g. raising Destino / reloading Fortuna) are applied by the API
after storing the roll, with origin `roll`, through the same authoritative path as the sheet.
Migration: `supabase/migrations/20260818120000_dice_rolls.sql`.

**`dice_attacks`** (migration `20260821000000_dice_attacks.sql`) — one row per melee attack waiting for an
answer. It stores the `RollRequest` already built **without the opposition group**, who attacks (the name
**copied**, so it can still say «te ataca un ogro» when the token is long gone), whom
(`target_character_id`, who is the one who may answer), with how many dice, and the state (`pending` ·
`resolved` · `cancelled`). `defence_dice` is the answer.

- ⚠ **`cancelled` is in the CHECK but nobody writes it today**: «the GM withdraws the attack» does not exist. An
  attack only goes away when answered, or in cascade if the scene or the character is deleted. When that button
  exists, the place is already made (`dice_close_attack(..., 'cancelled')`).
- **The mirror direction** (columns added 2026-08-22): the same table learns the opposite direction. With a
  target character it is a creature attacking a PC (the player answers, col. 5); without one it is a PC
  attacking a creature — `attacker_character_id` says who attacks and the attacked token which creature defends
  — and **the GM** answers with their creature's defence dice. The attacking character's owner can also read
  their row (they see their attack waiting).
- Tokens are released with `SET NULL`: deleting a token mid-session cannot delete the attack the player has in
  front of them, nor leave it unanswerable.
- It is **in the realtime publication**, which is what makes the notice pop up.

**`dice_roll_requests`** — one row per character the GM asks a roll of; «A TODOS» creates several rows with the
same `batch_id`, so the Registro can group the answers. It stores the characteristic, the difficulty, whether
their specialty counts, and the state (pending · resolved · cancelled) with the roll that answered it. Read by
the GM and the asked character's owner, nobody else. In realtime.

**`dice_combats` + `dice_combat_slots`** — a combat lives in a scene, one active per scene. The slots hold the
acting order (getting ahead by spending Fortuna reorders it and «el sitio nuevo se queda», p.92), whose turn it
is, and the round; `spent_next` are the dice already spent from the next turn (defences and advances, p.94). The
order is **seen by the whole table**; it is moved by the API. In realtime: the turn moves on every screen.

**The four operations — BUILT (server side, 2026-08-30)**, migration `20260830120000_dice_combat_functions.sql`
(applied in LOCAL **and in the cloud** on 2026-08-31 with his permission; ⚠ the cloud's stamp is
`20260830222940`, not the file's). The tables had been there since 22 August with no consumer; this is their
second half.

| Route | Who | What it does |
|---|---|---|
| `POST /combats` | GM | Opens it. **The order is set by the SERVER** with `orderTurns` |
| `POST /combats/:id/next` | GM | Passes the turn; on wrapping around, the round goes up |
| `POST /combats/:id/close` | GM | Closes it |
| `POST /combats/:id/advance` | The slot's owner | Gains one place and pays **1 Fortuna** |

- **A character's sheet is read by the server**, and whatever the client sends in `stats` for that slot is
  ignored — otherwise the caller would put themselves first by claiming Destino 99. **Creatures'** values are
  set by the GM: same perimeter as their rolls (debt already noted in bestiary).
- **Who counts as a «player character»** for the tiebreak is DEDUCED: whoever opens is the GM, so a character
  with another owner belongs to a player. ⚠ An allied NPC run by a player counts here as a PC; it is the same
  grey zone as «asking for a roll» and will be decided with it.
- **`spent_next` is settled** when the turn passes: the debt belonged to the turn that just ended (p.94). There
  is still **nobody who WRITES it** — tying it to an attack's defence is the next slice.
- ⚠ **Getting ahead: the book does not say by how much.** One place per point (⚠ interpretation, RULES.md §5.1)
  and you cannot jump over whoever is acting nor over those who already did.
- **No UI**: the `.pen` does not draw the turn order, and no screen is touched without an approved design.

**Ponerse a cubierto — no table**: it is a state of the token in the scene and lives in `maps_tokens.state`
(the JSONB that already exists and already travels through the tokens' realtime). The API writes it when
resolving the cover roll; shooting at a covered token costs +2 difficulty dice (p.96).

Migration of the panel: `supabase/migrations/20260822120000_dice_director_panel.sql` — applied in local, lint 0
errors. ✅ Applied in the cloud (2026-08-23, version `20260823005954` · security advisors 0 CRITICAL after).

### Connections

`game-system` (poolFor / resolve / actions) · `table` (shared resources) · `characters` / `bestiary` (where a
roll comes from) · `chat` (attaching a roll) · `maps` (distance and range, cover state, tokens) · `realtime`.

## Out of scope

- **3D dice** — asked for by him on 2026-08-18, not built. When they come: dice fall on screen, stop showing the
  result and disappear after a few seconds; the Registro does not change. **The animation decides nothing** —
  the server generates the dice with CSPRNG and the roll is immutable; the animation receives the already
  decided result and **lands on it** (3D dice libraries accept exactly that). It **loads apart**, by dynamic
  `import()` the first time the launcher opens, never at boot (WebGL + physics + meshes weigh hundreds of KB
  against a 105 KB gzip bundle), and if it fails the roll resolves anyway. Dice leave on their own after 3–4 s
  and can be dismissed with a click; they do not block the canvas. With `prefers-reduced-motion` there is no
  fall: the result appears directly. It opens from the **first tool** of the scene toolbar.
- **Ponerse a cubierto (p.96)** — ⚠ **NOT BUILT**, and it is the only thing in the rolls' `.pen` that is not.
  It would be: a challenge of **Combate or Astucia, the higher of the two**, against difficulty **1/2/3/5**
  depending on the cover; on success, shooting at you costs **+2 difficulty dice**. It would also close the «A
  cubierto» line the `.pen` asks for in the breakdown. It was deliberately left out: **a line that can only ever
  say «no» lies** (his decision, 2026-08-21). It does not appear in the breakdown until the rule exists.
- **Multiple attacks and defences** — splitting Combate dice between several opponents (p.94).
- **Capabilities that touch combat and do not exist yet**: Ira solar (adds to damage), Ponzoña (a separate
  attack), Amparo de la noche (automatic successes at night), Deflagración, Incorpóreo, Inmune al dolor (no
  wound penalty), Ancla terrenal. Full table in `RULES.md` §8. Until they exist, an ogre and a solar hit equally
  hard although the book says they should not.
- **Withdrawing an attack** (the `cancelled` state above).

## Decisions

### His, 2026-08-18
- **3D dice**, as described in § Out of scope. Pending, and explicitly not allowed to decide anything.

### His, 2026-08-20 — how a roll is asked for, and the GM's panel
- **The «Tirada» block of the sheet disappears**, and with it the sticky preset (difficulty, specialty, armour)
  that made every later roll come out «Difícil» without warning. It goes **when the GM's panel exists**, not
  before: removing it earlier would leave challenge rolls with no opposition at all.
- **In the player's modal there are no «the sheet already knows this» legends** — they killed the screen and
  added nothing. What the sheet knows is applied, full stop; if it needs explaining, it goes in the Registro's
  breakdown, not in the modal. The modal shows **two controls**: how many dice you roll and how many you take
  from the reserve; on a shot, the range as well. **Nothing more.**
- **Asking for a roll has no confirm button**: mark who, hold a characteristic, drop on the difficulty.
- **If the player does not answer, it waits forever.** Nobody rolls for them, not even the GM.
- **The GM's own rolls do NOT go in this panel**: they go in the launcher that already exists.

### His, 2026-08-21 — the turn order
Without turns, column 5 could not be built: defending **spends dice from the next turn**, and there was no next
turn. He chose to build the whole order rather than fake it with a counter (rules in § Rules & limits; the
server side was built on 2026-08-30 — `Engine.turnOrder`, optional like `tokenCells`, applied on both shores by
`orderTurns` in `@rolvium/core`; a comparator returning **0** is not a failure but the book's gap, and those
groups come out as `undecided` for the GM to break).

### His, 2026-08-22 — the mirror, the scope, and following the `.pen`
- **A PLAYER attacking a creature in melee** is the mirror of the same pipeline. He caught it attacking with
  Karen: «lo resolvió solo, ¿contra qué enemigo?» — it resolved on the spot against dice the player put in by
  hand. The book says the opposite: melee is a conflict between **both** Combates (p.93). So: the attacker
  declares the target, the GM gets the notice («Karen ataca al Lunar (4 dados)») and chooses how many Combate
  dice the creature spends defending, over the same `dice_attacks` pipeline, and the roll comes out grouped in
  the Registro with the player as its author.
- **«Otras tiradas» chips: the SEVEN characteristics**, one chip each — any roll of the creature in one tap.
  The `.pen` drew only three (FORTALEZA, ASTUCIA, SUTILEZA).
- **The scope of the slice: ALL TOGETHER** — the panel (asking + encounters), the turn order, the player's
  «tirada pedida» notice and the removal of the sheet's «Tirada» block.
- **Build following the `.pen` IN DETAIL.** What the design does not draw is not invented: it is shown to him
  BEFORE building it. That is why the three undrawn screens listed in § Screens are blocked.
- **«Que quede todo agrupado»**: a focused roll and its answer are **one grouped entry** in the Registro.

### Resolved against the PDF, 2026-08-21 — the blocker that was not one
It was written here that creatures had neither Combate nor damage. **Both halves were false.**
- **Characteristics**: they arrived with the Bestiary (H5). The ogre has Combate 4 and the panel can roll it.
- **Damage**: the book says it. A claw is an **unarmed attack**, and the weapons table (p.97) gives it
  **Daño: F**, the attacker's Fortaleza — the manual itself uses it that way in its example. The ogre hits for
  **8** per triumph. Nothing to invent, nothing to type. Recorded in `RULES.md` §8.
- ⚠ **«Garrote» and «Mordisco» are SPECIALTIES of Combate, not weapons**: they go in the specialty column. Giving
  them a row of the weapons table would be inventing a datum the book does not give.

### Mine, flagged rather than asked
- **The breakdown names a conflict a conflict** (p.93 against p.84): the request travels with `conflict: true`,
  and only because of that the breakdown says «Conflicto: 2 dados de defensa del otro lado» instead of «Reto a
  dificultad 2», closing with «… contra 1 **de la defensa**». The dice and the arithmetic are identical; the
  only change is not calling a conflict a challenge. The **Registro** still does not label the right-hand group
  (p.85) — it is the breakdown, opened by someone who already knows what the roll was about, that names it.
- **A failed roll leaves the attack pending** so it can be answered again, accepting the double-roll race
  described in § States & errors.
