# Review — invoke the `review` subagent

You have been asked to run the Review Agent (manually via `/review`, or
automatically because you just finished a coding task).

The Review Agent is a real subagent. Its full definition lives in
[.claude/agents/review.md](../agents/review.md) and runs in an isolated
context — its intermediate output does NOT pollute this conversation.

## What to do

1. Launch the subagent via the Agent tool with `subagent_type: "review"`.
2. In the `prompt`, include a short summary of what was just changed so
   the subagent has context (it cannot see this conversation). Format:

   ```
   Review the current uncommitted/staged diff for the Rolvium repo.

   Task summary:
   - <one or two bullets describing what was built/changed>
   - <list of the modules touched, e.g. "auth/LoginView", "admin/RolesTable", "shared/UIKit">

   Run all 6 steps in your system prompt and return the consolidated report.
   ```

3. When the subagent returns, present its report to the user verbatim.
4. If the subagent reports BLOCKED, the task is not done — surface the
   blocker so the user knows what is missing.

Do not run the checks yourself. The whole point of the subagent is to keep
the noisy output (grep results, build logs, test output) out of this
conversation.
