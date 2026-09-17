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
report. NO pidas verificación de claro/oscuro: no existe en este proyecto.
```

## Step 3 — Wait for the subagent's report

The subagent will return either ✅ PASSED, ⚠️ PASSED with warnings, or
🚫 BLOCKED. Present the report to the user verbatim.

If it returned BLOCKED → the task stops here. Do not continue to the
manual step. Surface the blockers so the user can fix them.

## Step 4 — ~~Verificación claro/oscuro~~ ELIMINADO (orden suya, 2026-09-17)

> «*es increíble que me toques los huevos con el claro oscuro en esta herramienta que … prácticamente no lo
> usa, incluso me lo pides cuando no hay un claro oscuro*»

**NO se le pide.** Dentro de la mesa manda el tema del sistema y no hay claro/oscuro; fuera, los tokens viven
en los dos temas en `RolviumApp.css` y `npm run audit` ya caza el hex crudo, el `#fff` y el `var()` con
fallback. Si hace falta comprobar que un token nuevo tiene su pareja en `[data-theme="light"]`, **se lee el
CSS** — no se le hace a él de comprobador.

## Step 5 — Final approval message

Con los pasos automáticos en verde, devolvé:

```
✅ QA — APPROVED FOR MERGE

Automated checks: [verbatim from subagent report]

→ Safe to merge to main. Invoke the Deploy Agent when ready.
```
