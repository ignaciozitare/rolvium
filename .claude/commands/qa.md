# QA — orchestrate the `qa` subagent + the two user-interactive steps

You have been asked to run the QA Agent (manually via `/qa`, or automatically
because the user said "ready to merge" / "this is done" / equivalent).

The QA Agent is a real subagent — see [.claude/agents/qa.md](../agents/qa.md).
But QA has two steps that REQUIRE talking to the user, and subagents cannot
talk to the user. So your job here is to orchestrate:

```
1. Ask the user the spec-compliance question      ← you handle this
2. Launch the qa subagent with the answer         ← subagent runs in isolation
3. Subagent does Steps 1-12 (all automated checks)
4. Subagent returns the report
5. Ask the user the light/dark verification       ← you handle this
6. Present the final consolidated QA result
```

## Step 1 — Ask the user about spec compliance blocking

Ask the user this question and wait for the answer:

> "Antes de empezar la review de QA — si encuentro que algo se construyó
> distinto a lo que dice el spec, ¿lo bloqueo, o lo marco como warning para
> que decidas vos?
>
> Respondé 'block' o 'warn'."

Store the answer as `specComplianceMode`. Do not continue until the user
replies.

## Step 2 — Launch the qa subagent

Use the Agent tool with `subagent_type: "qa"`. In the `prompt`, include
the inputs the subagent needs:

```
Run the QA gate for the Rolvium repo.

specComplianceMode: <block|warn>

Task summary:
- <what was built/changed>
- <modules touched>

Branch: <current branch>
Target: main

Execute all 12 steps in your system prompt and return the consolidated
report. Do NOT perform the light/dark visual verification — I handle that
separately after you return.
```

## Step 3 — Wait for the subagent's report

The subagent will return either ✅ PASSED, ⚠️ PASSED with warnings, or
🚫 BLOCKED. Present the report to the user verbatim.

If it returned BLOCKED → the task stops here. Do not continue to the
manual step. Surface the blockers so the user can fix them.

## Step 4 — Manual light/dark verification (only if the subagent passed)

Ask the user:

> "Para terminar QA, hacé esto manualmente — 2 minutos:
> 1. Abrí la app en el browser
> 2. Andá a cada vista que se modificó en esta tarea
> 3. Toggle entre dark y light en cada una
> 4. Confirmá que no hay colores rotos, texto invisible, white-on-white o
>    black-on-black
> 5. Respondé 'light/dark ok' cuando termines"

Do not approve the merge until the user confirms. If the user reports a
visual issue, identify which CSS variable is missing its `[data-theme="light"]`
override in `apps/web/src/RolviumApp.css`, fix it, and ask the user to re-verify.

## Step 5 — Final approval message

Once the user confirms light/dark, return:

```
✅ QA — APPROVED FOR MERGE

Automated checks: [verbatim from subagent report]
Light / Dark manual verification: ✅ confirmed by user

→ Safe to merge to main. Invoke the Deploy Agent when ready.
```
