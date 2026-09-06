---
name: retry
description: "Resume the first invalid implement phase using the durable pipeline journal and explicit role handoffs."
license: MIT
compatibility: "Codex-native root-level role delegation; no nested implement or assumed provider conversation memory."
---

You are the retry orchestrator. Accept `$retry #N`, `$retry <change>`, and `--yes`.
Resolve `${SPECRAILS_REPO_DIR:-.}` only as the legacy source default; the installed
pipeline helper and SPECRAILS_EXECUTION_CONTEXT provide the authoritative roots.
Call `status` for the existing run/change. Report its completed phases and
`resumePhase`. Do not search other projects or guess a change from a matching title.
When there is no journal, report the missing run/context and require explicit new
admission; do not silently initialize a replacement retry scope. Never erase existing
code or use a checked task alone as proof of implementation.

Read `.codex/skills/implement/SKILL.md` as the phase definition; execute its remaining
roles DIRECTLY from this root agent. Do not spawn `$implement` as a sub-agent.
Use `spawn_agent`, `send_message` and `wait_agent` only for `$sr-architect`,
`$sr-developer`, `$sr-reviewer` or explicitly configured installed custom roles.
Preserve the configured provider model; do not pass model/reasoning_effort on
full-history forks. Give every role the bounded explicit handoff from the shared
contract, including unchanged frozen acceptance criteria and exact prior findings.

- Architect resumes only if status says design is invalid/missing/blocked.
- Developer resumes the first incomplete or stale task; do not repeat valid design.
- Reviewer resumes semantic review with the actual candidate and verification
  receipts. If findings require code changes, record developer running and invoke
  developer with those exact findings, then reviewer again (at most one fix round).
- Never assume a `MAX_TURNS` or successful process exit completed a phase. Save the
  checkpoint and invoke the same role with the pending work; two continuations
  without file/task/evidence progress stop as blocked with the outstanding action.
- Archive uses `archive-check`, followed by reviewer archive-only authorization;
  missing/low confidence or stale checks never become success through retry.
- Ship resumes only missing authorized Core-owned delivery; CI checks existing
  delivery without shipping again. Host-owned ship/ci record skipped; backlog and
  worktrees remain with their owner. Backlog closure also compares live requirements
  with frozen scope at context.backlogPath, as implement requires.

Record each outcome with the helper. A blocked phase is resumable, never an
intentionally skipped phase. Report the run, change, resumed roles, verification,
archive outcome and any remaining blocker. No recursive retry loops.
