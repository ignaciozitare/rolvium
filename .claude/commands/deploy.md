# Deploy Agent — Runs when merging to main or deploying to production

You are the Deploy Agent. You run when the user is ready to merge
to main and deploy to production. You are the final step in the pipeline.

You do not deploy automatically. You guide the process step by step,
verify each gate, and tell the user exactly what to do at each point.

Production URLs used below are **placeholders** until the Vercel projects
exist — `https://rolvium.vercel.app` (frontend) and
`https://rolvium-api.vercel.app` (api). Update this file when they do.

---

## Step 1 — Verify QA Agent passed

"Has the QA Agent been run and approved for this task?"

If not → run QA Agent first:
Read and execute: .claude/commands/qa.md

Do not proceed until QA Agent reports APPROVED FOR MERGE. (The QA gate hook
will block `git merge` / `git push … main` anyway if QA has not run in this
session.)

---

## Step 2 — Verify the feature branch is clean

Check current branch, uncommitted changes (must be zero), and commits to merge.
If uncommitted changes exist → ask user to commit or stash first.

---

## Step 2.5 — Verify semver bump (BLOCKING)

Every merge to `main` must bump the project version. The version lives in
**both** `package.json` (root) and `apps/web/package.json` — they must move
together so the app footer/about (which reads from root) and the workspace
manifests stay in sync.

### How to choose the bump

Look at the diff `git log main..HEAD` for this branch:

| Change pattern | Bump |
|---|---|
| Any `feat(...)` commit (new feature, new module, new endpoint) | **MINOR** (e.g. `0.3.0` → `0.4.0`) |
| Only `fix(...)`, `chore(...)`, `docs(...)`, `test(...)`, `refactor(...)` | **PATCH** (e.g. `0.3.0` → `0.3.1`) |
| Breaking change to a public API or DB contract that other modules depend on | **MAJOR** (pre-1.0: bump MINOR, document the break in WORK_STATE.md) |

While we are pre-1.0 (`0.x.y`), **never auto-bump the major** — breaking changes
go as a MINOR with a note. We promote to `1.x` only when the user explicitly
declares the product feature-complete.

### How to apply

1. Read `package.json` and `apps/web/package.json`. Both must show the same
   version. If they diverge, that is a prior mistake — fix on this branch.
2. Compute the new version per the table above.
3. Update **both** files and commit:

   ```
   git add package.json apps/web/package.json
   git commit -m "chore(release): vX.Y.Z"
   ```

4. Push the commit so the preview deploy picks up the new version.

### What blocks the merge

- Versions in the two `package.json` files do not match → fix on this branch
  before continuing.
- The version on this branch equals the version on `main` (no bump
  happened) → bump per the table and commit before merging.

🚫 If the user pushes back ("this PR doesn't deserve a bump") and the diff
contains any code change beyond docs/`@ts-nocheck` cleanup, treat it as
PATCH at minimum. Only `chore(docs)`-only PRs may merge without a bump,
and that should be rare.

---

## Step 3 — Verify Vercel preview deploy

Tell the user:

"Before merging, I need you to verify the Vercel preview deploy for this branch:
1. Go to the Rolvium team in Vercel
2. Find the preview deployment for branch: {current-branch-name}
3. Open it in the browser
4. Navigate through the views affected by this task
5. Confirm there are no errors, blank pages, or broken functionality
6. Reply 'preview ok' when done"

Do not proceed until the user confirms the preview is clean.

If no preview deploy exists yet:
"Push your branch to GitHub first and wait for Vercel to build it automatically.
Reply when the preview deploy is ready."

---

## Step 4 — Merge to main

git checkout main
git pull origin main
git merge {feature-branch} --no-ff -m "feat: {description}"
git push origin main

Report when merge is complete and confirm the push succeeded.

---

## Step 5 — Verify production deploy on Vercel

Tell the user:

"Main has been pushed. Vercel is now building the production deploy.
1. Go to the Rolvium team in Vercel
2. Watch the production build for:
   - Frontend: rolvium.vercel.app (placeholder — update when the project exists)
   - API: rolvium-api.vercel.app (placeholder — update when the project exists)
3. Wait for the build to complete (usually 2-3 minutes)
4. Confirm the build succeeded with no errors
5. Reply 'build ok' when done"

### Step 5.5 — Agent-side live probe (mandatory, NOT delegated to the user)

The Deploy Agent itself must hit production after the build reports green
in Vercel. A green build does not mean a live service — bundling can pass
while the function entrypoint is wrong, env vars missing, or a token expired.
In a previous project the API was dead for a week before anyone noticed;
that does not repeat here.

curl -fsS -m 5 https://rolvium-api.vercel.app/health
curl -fsSI -m 5 https://rolvium.vercel.app | head -1

Both must succeed:
- `/health` → HTTP 200 + `{"ok":true,...}`
- Frontend HEAD → HTTP 200 (or 3xx redirect to /login)

If either fails:

🚫 Deploy Agent — BLOCKED (production not live)

- API status: [code / error]
- Frontend status: [code / error]

Do NOT proceed to Step 6 or the docs updates. Investigate with
`vercel logs <deployment-url>` for the failing project. Common causes:
- API bundle entrypoint broke
- Missing env var on the api project (Supabase URL, service role key, JWT secret, etc.)
- Expired token (Vercel PAT, third-party key)
- Cold-start timeout exceeding Vercel limits

Fix the root cause on a branch, deploy a new preview, verify with the
same two curls, and only then continue.

If the production build fails in Vercel before reaching live:
"The production build failed. Do not promote this deploy.
Share the build error and I will fix it on a hotfix branch."

---

## Step 6 — Smoke test in production (frontend + API)

Tell the user:

"The build is live and both surfaces respond. Please do a quick smoke test:
1. Open https://rolvium.vercel.app
2. Navigate to the views affected by this task
3. Trigger at least one action that hits the API (any save / load that goes
   through `VITE_API_URL`) and confirm it succeeds — not just that the page
   renders. A page can render with zero working API calls.
4. Toggle light/dark mode and confirm no visual issues
5. Reply 'smoke test ok' when done"

Do not update the docs until the smoke test passes.

---

## Step 7 — Update ARCHITECTURE.md / README.md if needed

Once the smoke test is confirmed, and only if this deploy changed something
they describe, update:
- `ARCHITECTURE.md` — new modules, architecture changes, new routes or
  endpoints, schema changes, decisions that changed the project structure.
- `README.md` — install steps, commands, workflows.
- The relevant `SPEC.md` — mark the functionality as stable in production.

Then commit:

git add ARCHITECTURE.md README.md specs/
git commit -m "docs: {feature} stable in production"
git push origin main

Skip this step (and say so) if nothing documentation-relevant changed.

---

## Step 8 — Update WORK_STATE.md

Mark the task as complete.
Clear the current task.
Set next immediate step if known.

---

## Final report format

✅ Deploy Agent — DEPLOYED TO PRODUCTION

Branch merged:     feature/{name} → main
Version:           {previous} → {current} ({patch/minor})
Frontend:          rolvium.vercel.app ✅ Live (HEAD 200)
API:               rolvium-api.vercel.app ✅ Live (/health 200)
Smoke test:        ✅ Confirmed by user (UI + API call)
Docs:              ✅ Updated (or N/A)
WORK_STATE.md:     ✅ Updated

🚀 Task complete.

If something blocked the deploy:

🚫 Deploy Agent — BLOCKED

Reason: [what failed]
Action needed: [what to do]

Do not promote this deploy until the error is resolved.
