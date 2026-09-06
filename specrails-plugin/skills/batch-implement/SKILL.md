---
name: batch-implement
description: "sr:batch-implement — Batch implementation orchestrator. Accepts multiple feature references, computes dependency-aware execution waves, invokes sr:implement per wave."
license: MIT
compatibility: "Requires git."
metadata:
  author: specrails
  version: "1.0"
---

# Batch Implement

Plugin invocation mapping: logical sr-architect/sr-developer/sr-reviewer IDs use the installed plugin agents specrails:architect, specrails:developer and specrails:reviewer. Profile IDs remain logical; verify available plugin agents instead of requiring local agent files.

**Input:** $ARGUMENTS — selected ticket references, dependency hints, --dry-run/--preview or existing aggregate change for retry.

## One scope and one candidate

Use implement's installed runtime and immutable execution context. Host context.specs[] is the batch; never replace it from another repository's backlog. Standalone init --change <aggregate-change> --tickets "17,18" freezes local entries once; freeform/multi-repo uses explicit scope request/context.

There is **one aggregate OpenSpec change and one journal**, not a full pipeline per ticket. Delegate to implement once with all frozen specs and selected roots. Architect, developer, reviewer, confidence, archive and delivery gates are mandatory and resumable.

## Dependency plan

1. Validate dependency IDs against selected specs/completed external prerequisites; reject cycles or missing prerequisites.
2. One architect designs shared contracts and task groups labeled with ticket/repository ID. Cross-repository behavior belongs to the same acceptance matrix.
3. Execute dependency-ordered groups in supplied roots; serialize shared-file/contract changes. Profile routing selects appropriate roles; each handoff includes exact context/runtime paths.
4. Collect foreground terminal results. Task start or unsupported PASS is not completion.
5. Scoped tests support development; one full receipt covers the aggregate candidate and cross-repository integration. Reviewer reuses it unchanged; edits need a fresh final full pass.

Never recursively launch implement for each wave, change the run identity, allocate nested worktrees, guess a main branch, merge copied file lists or delete supplied roots. Respect host/Core ownership from entry.

## Acceptance and completion

Review every ticket's criteria before canonical confidence. Runtime reviewer and archive approval gates precede official archive. Missing implementation/regressions, low confidence or one required failed repo keeps the batch incomplete; preserve per-ticket/repository retry progress.

Preview remains unverified until runtime apply checks an unchanged base and executes checks on applied candidate. Retry resumes earliest invalid phase, preserving valid design and successful delivery.

Core-owned backlog may close only after complete delivery and matching current/frozen requirements. Host-owned backlog remains for host acceptance. Report partial outcomes and preserve reviewable work.
