# Security — invoke the `security` subagent

You have been asked to run the Security Agent (manually via `/security`, because
the owner asked whether something is safe, or because a merge to `main` carries
API code, a migration or authentication code — the merge gate requires it).

The Security Agent is a real subagent: [.claude/agents/security.md](../agents/security.md).
It is read-only and runs in an isolated context.

## What to do

1. Launch it with the Agent tool, `subagent_type: "security"`. In the prompt:

   ```
   Security review for this repo.

   Branch: <current branch>   Target: main
   scope: diff          ← or `scope: full` if the owner asked for the whole repo

   Task summary:
   - <what was built/changed, modules touched>
   - <new tables/columns, new routes, anything that stores or reads a credential>
   ```

2. Present its report to the owner **verbatim**, including the «No ejecutado» line
   and the known debt. Do not summarise the debt away.
3. If it returned BLOCKED, the task is not done and nothing goes to `main`. Fix the
   findings as Dev (through the normal order: spec if behaviour changes), then run
   it again.

Do not run its checks yourself, and do not treat Review or QA as a substitute:
they look at the code; this looks at how secrets are stored and who can reach them.
