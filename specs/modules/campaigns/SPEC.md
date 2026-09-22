# Campaigns (H2) — SPEC

> **Written to REBUILD the module from scratch**, not as a decisions diary — the nine-section template that
> `CLAUDE.md` § «Specs» mandates since 2026-09-17. English throughout; his own words are quoted verbatim in
> Spanish. Restructured on 2026-09-20 from the previous version, diffing against it so nothing was lost.

## Purpose

A group organises itself into **campaigns**: the GM creates one, picks the game system, invites players and
opens the table. Everything else in Rolvium hangs off a campaign — its scenes, its characters, its rolls, its
whispers and its adventures.

**Who uses it:** creating is for `game_master` / `admin`; joining is for any signed-in user. Inside a campaign
there are only two table roles, `dm` and `player`.

## What the user can do

**Anyone signed in**
- **See the home** `/campaigns`: «Mis campañas» (system, name, GM, my character, last session, next session, and
  *Entrar a la mesa* / *Abrir la mesa* if I run it) · «Campañas abiertas a nuevos jugadores» (free seats,
  *Pedir unirme*) · «Unirme con código» · shortcuts to create.
- **Join with a code or a link**, or **ask to join** an open campaign.
- **Leave** a campaign.

**The GM**
- **Create a campaign** with the wizard: name → **game system** (from the installed ones, with a preview of «así
  se verá la mesa») → visibility (open / by invitation) and seats → table options (progression on or off, the
  system's initial shared resources, the table's language) → **invite players** (code, link, e-mail; seats taken
  and free).
- **Manage it**: regenerate the code, accept or reject requests to open campaigns, remove a member, change seats
  and visibility, turn progression on and off, archive the campaign, and set the next session (date and time).
- **Open the table** (`/table/:id`).

## Screens

| Screen | What it is | Plate |
|---|---|---|
| Home | My campaigns · open ones · join with a code | § 2 · `Campañas/Home · dark` + `· light` |
| Create · system | Step of the wizard that picks the system, with its preview | § 2 · `Campañas/Crear · Sistema · dark` + `· light` |
| Create · invite | Code, link and seats at the end of the wizard | § 2 · `Campañas/Crear · Invitar · dark` + `· light` |
| Manage panel | The GM's panel: code, requests, members, next session, progression, archive | Inside the home plates |

This module lives **outside the table**, so it uses the app's tokens and **both themes are mandatory** — unlike
everything under `.tb-root`, which is dressed by the game system.

## Rules & limits

- **A campaign never changes its system.** It is anchored at creation (`system_id` + `system_version`) and a
  trigger refuses to change it; the wizard warns before creating.
- **A campaign whose system is not installed** shows greyed out («sistema no instalado») and cannot be opened.
- **Seats: 1–12 players** (8 recommended). **The GM does not take a seat.**
- **Progression is off by default.** The initial shared resources are the system's (e.g. Destino 10).
- **Invite codes** are unique, readable (`XXXX-XXXX`) and regenerable; the GM can disable them.
- Joining by code is **idempotent** and checks, in one place: the code is enabled, the campaign is not archived,
  and there is a free seat.
- A request can only be resolved while it is `pending`, and accepting it needs a free seat.

## States & errors

| State | When | What is seen |
|---|---|---|
| No campaigns yet | A new account | The empty home, with the shortcuts to create or to join with a code |
| System not installed | The campaign's system is not in this build | The card greyed out, «sistema no instalado», and the table cannot be opened |
| Archived | The GM archived it | It is out of the way; it is not deleted |
| Full campaign | Joining or accepting with no free seat | `campaign_full` from the database. ⚠ It still shows the generic message — the specific copy is pending (§ Out of scope) |
| Request already resolved | Two GMs, or a double click | `already_resolved`. ⚠ Same pending copy |
| Wrong or disabled code | Joining with a code | The join does nothing and says so |
| Already a member | Joining twice | Nothing happens: the join is idempotent |

## Permissions

| Action | Who | How it is enforced |
|---|---|---|
| Create a campaign | `game_master` or admin, as its own GM | RLS + `can_create_campaigns()` |
| Read a campaign | Its members and its GM; anyone if it is open and not archived | RLS |
| Update / archive | The GM (or an admin) | RLS |
| Read the member list | Members of that campaign | RLS |
| Write a member row | The GM, any row. A player only leaves (deletes their own) or updates **only `character_id`** in theirs | Column grant + a trigger that refuses role/campaign/user changes unless you are the GM |
| Join | Anybody with a valid code | `join_campaign_by_code(code)` (SECURITY DEFINER), or the GM accepting a request |
| Read the invite code | **Only the GM** | `invite_code` is **not readable by SELECT** for `authenticated` (grant by columns); the GM gets it with `campaigns_my_invite_code(cid)` and rotates it with `campaigns_regenerate_invite_code(cid)` |
| Create / delete a request | The requester, while pending | RLS |
| Resolve a request | The GM | `campaigns_resolve_request(req, accept)` |

**Helpers reused by every other hexagon**: `is_campaign_member(id)`, `is_campaign_dm(id)`,
`can_create_campaigns()`. And `campaign_invite_preview(code)` for the preview — for signed-in users; visitors
get it through the API with the service role, **never `TO anon`**.

## Data model

Migrations: `supabase/migrations/20260817120000_campaigns.sql` and the hardening
`20260817140000_campaigns_hardening.sql` (both applied in local; lint 0 errors, audit 0 hard).

- **`campaigns_campaigns`** — one row per campaign: name, description, **anchored system** (`system_id` +
  `system_version`, with the trigger that refuses to change them), GM (`dm_id`), visibility (`open`/`invite`),
  seats (1–12), invite code (`XXXX-XXXX`, unique, regenerable, `invite_enabled`), progression enabled,
  `shared_resources` (jsonb the system manages), the table's language, the active scene (the FK is added by
  `maps`), next/last session, archived.
- **`campaigns_members`** — who is in the campaign and with which table role (`dm`/`player`); `character_id`
  links the sheet (the FK is added by `characters`). **The GM is inserted by a trigger** when the campaign is
  created.
- **`campaigns_requests`** — requests to open campaigns (`pending`/`accepted`/`rejected`).
- **Functions**: `join_campaign_by_code` (locks the row), `campaigns_resolve_request` (requires `pending` and a
  free seat), `campaigns_my_invite_code`, `campaigns_regenerate_invite_code`, `campaigns_players_count(cid)`
  (gives the count to whoever may see the campaign).
- Related, in `table`: `table_take_resource(cid, rid, n)` reads `perTakeMax` from the stored resource.
- **Every campaign is born with its «Aventura 1»** — a trigger of `adventures` (H12), so that the rule «every
  scene belongs to an adventure» has no exceptions. See `specs/modules/adventures/SPEC.md`.

### Connections

`identity` (signing up with a code) · `game-system` (the installed list and the initial `sharedResources`) ·
`table` (opening it) · `characters` (a member's sheet) · `maps` (the active scene) · `adventures` (the seeded
first adventure) · `realtime` (one channel per campaign) · `notifications` (**future**: invitation by e-mail,
next-session reminder).

## Out of scope

- **Specific messages for `campaign_full` and `already_resolved`** — the errors exist and are enforced; only the
  copy is generic.
- **Editing name, description, seats and visibility from the manage panel** (they are set in the wizard).
- **Invitation by e-mail and reminders** — they need `notifications`, which does not exist.
- Changing a campaign's system, ever (see § Rules & limits).

## Decisions

- **The system is anchored at creation.** A campaign is its system: sheets, rolls and theme all come from it, so
  letting it change would break every sheet already written. The wizard says so before creating.
- **The GM does not take a seat**: the seats are the players'.
- **Progression off by default** — a table decides whether characters improve, and starting with it on surprises
  the GM mid-session.
- **The invite code is not readable by SELECT** (hardening of 2026-08-17, after the review): any member could
  otherwise read the code of a campaign they are in and pass it on. Now only the GM sees it, through its
  function, and rotating it is one call.
- **A player can only change `character_id` in their own member row**, enforced by a column grant *and* a
  trigger — not by the screen. The screen is not a permission.
- **Joining goes through one SECURITY DEFINER function**, never through a direct insert: the three checks (code
  enabled, not archived, free seat) have to be in a single place that cannot be skipped.

### State of v1 (2026-08-18)

Built, beyond create/join: the GM's **Gestionar** panel (code + link + regenerate, accept/reject requests,
members with remove, next session, progression open/closed, archive), **Abandonar** for players, and the
`/systems` page — whose catalogue of installed and upcoming systems is described in
`specs/core/game-system/SPEC.md`.
