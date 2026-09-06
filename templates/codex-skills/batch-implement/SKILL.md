---
name: batch-implement
description: "Implement the frozen batch in one OpenSpec change and journal, with aggregate verification, review and archive gates."
license: MIT
compatibility: "Codex-native root-level role delegation. One aggregate change per run; hosted worktrees stay under host ownership."
---

You coordinate one batch run. Explicit #IDs retain their order; filters resolve
against the shared backlog. Freeze the full ticket descriptions, acceptance criteria
and repository IDs once. With host context use its complete specs unchanged.

Initialize ONE stable aggregate change slug and journal for the batch. Do not
initialize another change with the same runId or create child per-ticket journals.
Resolve source via context.repositories, OpenSpec via context.artifactRoot, and
backlog via context.backlogPath/backlogRoot; cwd can be an external workspace.

Read the single implement role instructions, but execute the following aggregate
pipeline DIRECTLY from this root. Do NOT spawn `$implement` as a sub-agent.
Each role receives the explicit bounded handoff including ALL frozen specs and
repository paths, aggregate change slug and already completed task groups.

1. Architect: one `$sr-architect` creates and validates one change covering every
   ticket, grouping tasks by ticket and repository and recording dependency order.
   Record architect running/done via the helper. Require high/medium design
   confidence. Missing or low confidence blocks development; never infer a pass.
2. Developer: one `$sr-developer` applies the task groups sequentially, preserving
   preceding groups and all repositories. Persist per-group progress in tasks.md
   before yielding. Scoped checks run per group; the full verification gate runs
   once for the aggregate candidate through the helper. Only then record developer
   done. Incomplete groups block downstream review and remain retriable.
3. Reviewer: one `$sr-reviewer` semantically checks every ticket/criterion and
   cross-ticket interaction. Include the full receipt and changed-file inventory.
   Ordinary review does NOT archive. If recoverable findings need changes, invoke
   developer once with the exact findings and re-review. Missing/ambiguous verdicts
   and stale receipts never become done; record blocked/failed with a next action.
4. Archive: after semantic reviewer done and canonical confidence thresholds from
   implement pass (including security), run `archive-check`. Only success permits
   `$sr-reviewer` with ARCHIVE_ONLY=true and ARCHIVE_AUTHORIZED=true. Validate the
   archive exists and active change is absent; record archive done. Failure leaves
   EVERY batch ticket open.
5. Delivery/CI: follow implement ownership exactly. Host-owned Git records ship/ci
   skipped and returns evidence; Core-owned authorized delivery records each selected
   repository outcome and required CI. Partial delivery keeps the batch incomplete.
6. Backlog: only Core-owned backlog may close participating tickets at
   context.backlogPath after required delivery and live-vs-frozen requirements match.
   Preserve unrelated data and revisions. Host-owned backlog stays untouched.

Before any role, inspect status.resumePhase; reuse every still-valid phase without
respawning. Use available worker capabilities and capability-aware cleanup from
implement; never invent close_agent or native model override support.

On a provider turn limit, continue the same role from explicit saved progress;
never launch a nested coordinator or repeat valid earlier stages. Retry resumes
this same aggregate change/journal. Two continuations without progress block.

`--parallel` is a preference, not permission to create unmanaged worktrees or
assume ten available agent slots. The aggregate pipeline is sequential by default;
keep hosted worktrees in the supplied repositories. Do not claim parallel work
when it did not run. Do not override models on a full-history fork.

Report one table with every ticket and actual implemented/reviewed outcome, the
aggregate verification receipt, archive result and outstanding groups. No ticket
is done until the whole aggregate close succeeds.
