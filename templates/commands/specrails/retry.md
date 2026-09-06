# Retry an Implementation Pipeline

**Input:** $ARGUMENTS — existing change and optional --from <phase>.

## Resolve the exact run

Use the same absolute SPECRAILS_PIPELINE_RUNTIME and SPECRAILS_EXECUTION_CONTEXT. The managed fallback is .specrails/runtime/pipeline.mjs; the standalone workspace pointer is only discovery. Do not initialize another run, choose the newest change, replace frozen tickets from mutable backlog, or trust old ad-hoc pipeline state.

```bash
node "${SPECRAILS_PIPELINE_RUNTIME:-.specrails/runtime/pipeline.mjs}" status --json
```

Verify runId/change match. Preserve context.specs, selected roots, backlog identity and ownership. The artifact compatibility root is `${SPECRAILS_REPO_DIR:-.}`, not necessarily the framework workspace.

## Resume earliest invalid evidence

Follow resumePhase and receipt reasons. Completed valid phases require no model call. Blocked/failed is resumable; never convert dependent implementation into skipped. Explicit --from can reopen an earlier phase, but runtime prerequisite checks still apply.

```bash
node "${SPECRAILS_PIPELINE_RUNTIME:-.specrails/runtime/pipeline.mjs}" phase --phase <phase> --status running
```

| Phase | Resume action |
|-------|---------------|
| architect | Repair official design artifacts/confidence; unblock development only after actual gate passes. |
| developer | Continue unchecked tasks, retain completed code; scoped repairs followed by one full receipt. |
| reviewer | Review acceptance/confidence; reuse current full evidence, refresh after edits. Do not redo valid architecture because review was blocked. |
| archive | Fresh archive-check, then authorized official archive/sync only; preserve approved confidence bytes. |
| ship | Only Core-owned and authorized; resume missing repository delivery without duplicating successful commits/PRs. |
| ci | Check existing delivery; never reship merely because CI needs retry. |

Only host-owned ship/ci may skip. Actual done clears old reason; failed/blocked records concrete remaining work. Reopening invalidates dependent completion.

## Evidence and report

Use the implement contracts for command receipts, foreground worker completion and exact repository routing. Receipt validity plus required command coverage permits reuse; baseline-only or stale evidence does not. Preview apply must check base/cache and execute checks on actual applied source.

Confidence, acceptance and archive approval precede delivery. Preserve host-owned Git/worktrees/backlog. Return current state, reused/new evidence and per-repository outcomes. If all phases remain valid, report completion without rerunning.
