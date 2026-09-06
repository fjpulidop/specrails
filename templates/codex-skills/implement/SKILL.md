---
name: implement
description: "Implement one frozen spec or route multiple specs to an aggregate pipeline, with resumable design, implementation, verification, review, archive and ownership-aware delivery."
license: MIT
compatibility: "Codex-native role delegation with explicit handoffs and the installed SpecRails pipeline runtime. Use only capabilities exposed by the host."
---

You coordinate the implementation. Role skills supply design, coding and review
instructions; the installed runtime supplies immutable scope, phase status and
actual verification evidence. A completed valid phase needs no new model call.

**Input:** `$implement #N`, `$implement #N --yes`, a free-form description, or
multiple `#N` references. More than one ID routes directly to
`.codex/skills/batch-implement/SKILL.md` with the original arguments and complete
frozen context. Do not ask the user to resend or spawn a nested implement.

## Admission and capabilities

Follow the executable pipeline contract above. Initialize the one stable change
with supplied context, explicit ticket IDs, or a free-form scope request; then
read `status`. Do not initialize another run on retry or replace frozen requirements
with live ticket text. OpenSpec lives under `context.artifactRoot`; the compatibility
path `${SPECRAILS_REPO_DIR:-.}/openspec/changes/<slug>/` applies only after resolving
that variable to artifactRoot. Source/tests use the selected repository ID/path;
backlog uses `context.backlogPath`, independent of cwd.

Discover `.codex/skills/rails/` and require sr-architect, sr-developer and
sr-reviewer. Validate any explicit profile (`SPECRAILS_PROFILE_PATH`, otherwise the
project's configured default): schemaVersion 1, baseline trio, routing/default and
referenced installed roles. Only installed custom-* roles may supplement or fulfill
a routed task group; they do not bypass the canonical phase gates.

Use the host's actual `spawn_agent`, `send_message` and `wait_agent` signatures.
Invoke required architect/developer/reviewer roles as real workers and collect their
terminal outcomes. Full-history forks inherit the current model; do not pass model
or reasoning overrides unsupported by that fork mode. Report unsupported profile
model overrides honestly. Use `close_agent` only when that capability exists and
only after the worker finished; never invent a cleanup tool or interrupt running
work to simulate completion. Avoid parallel writers in shared candidate roots.

Every worker receives its `$sr-*` skill and the explicit bounded handoff: runId,
phase, absolute runtime/context paths, all frozen criteria, repository ownership,
change/plan/tasks paths, prior outcome and next action. Do not rely on inherited
conversation memory. A task start, turn limit or process exit alone is not success.
Continue from durable progress; two continuations without progress become blocked.

## Durable phases

`architect → developer → reviewer → archive → ship → ci`

Follow `status.resumePhase`. Start required work with the helper's
`phase --phase <phase> --status running`. Record done only after validating actual
outcomes and runtime gates. Record blocked/failed with a concrete reason; dependent
phases remain incomplete. Reopening a phase invalidates dependent completion.
If every phase is valid, report existing completion without new worker calls.

### Architect

Invoke `$sr-architect` with the exact slug and aggregate frozen scope. Use the
installed official OpenSpec fast-forward workflow. Require proposal, design, specs,
tasks and medium/high design-confidence.json. Missing/malformed/low confidence
blocks development; record the unresolved issue and retain artifacts for retry.
Do not edit a ticket and silently substitute the new description into this run.
Changed requirements need a newly admitted scope.

### Developer

Invoke `$sr-developer` or the validated profile role for each task group. Keep
source writes in its selected repositories, serialize dependencies/shared files,
and persist real task progress. A BLOCKED outcome stops downstream phases.
Scoped checks support development; once all groups are implemented, execute one
full CI-equivalent check request through the installed helper. Derive actual checks
from each selected repository and include required cross-repository integration.
All tasks and current full evidence must pass before recording developer done.

### Reviewer and bounded repair

Invoke `$sr-reviewer` with complete criteria, candidate inventory and current
verification receipt. Ordinary review does not archive. Require explicit semantic
acceptance, safe behavior and required regression coverage; green baseline tests
with missing implementation are incomplete. Reuse unchanged full verification;
review edits require one fresh final full request on the resulting candidate.

Read canonical `<context.artifactRoot>/openspec/changes/<slug>/confidence-score.json`.
Require overall ≥70, security ≥75 and every other aspect ≥60 (or stricter configured
thresholds), all tasks complete and no unresolved explicit blocker. Missing or
ambiguous verdicts/scores fail closed. A numeric score never converts a blocked
security or design finding into clean acceptance.

For concrete recoverable findings, reopen developer and invoke it once with those
exact findings, then re-review and refresh evidence. An architectural blocker
returns to architect; do not infer its category from a score range. If the one
repair round does not resolve acceptance, preserve work and record blocked.
Only then may the runtime record reviewer done.

### Archive

Run `archive-check` immediately before archiving. Nonzero means stop. After success,
invoke `$sr-reviewer` with ARCHIVE_ONLY=true and ARCHIVE_AUTHORIZED=true and the
same explicit handoff, or run the installed official archive workflow directly
as coordinator. Preserve approved confidence bytes; no rescoring or code changes.
Confirm the exact active change is gone, its archive exists under
`<context.artifactRoot>/openspec/changes/archive/<date>-<slug>/` and canonical specs
synced before `phase --phase archive --status done`. Do not emulate an official
archive with file moves or accept incomplete-task prompts. A failed archive remains
resumable; it never closes specs or restarts valid development automatically.

### Delivery and CI

For `context.ownership.git === "host"`, record ship and ci skipped with the ownership
reason and return evidence to the host. Do not stage, commit, push or open PRs.
For Core-owned git, perform only the delivery already authorized by user/settings,
in each selected repository. `GIT_AUTO=false` and preview disable shipping even if
Core owns git. Preserve unrelated changes; stage only the reviewed candidate.
Record actual per-repository commits/PRs and required CI results before phase done.
Partial delivery stays incomplete. CI retry checks existing delivery, without
creating duplicate commits or PRs. No authorized delivery means a concrete blocker,
not a fabricated successful ship phase.

### Backlog and report

Host-owned backlog remains untouched. Core-owned backlog may close only after all
required delivery succeeds, current evidence remains valid, and live participating
ticket requirements still match frozen IDs/descriptions/criteria/repository scope.
A mismatch leaves that ticket open and reports the conflict. Read/write only
`context.backlogPath` (fallback context.backlogRoot/.specrails/local-tickets.json),
preserve unrelated tickets/fields, and apply the store's revision protocol. Workers
never close tickets. A free-form scope without a real ticket has no ticket mutation.

Report run/change, frozen tickets/roots, reused and newly completed phases,
verification commands, confidence, archive and each repository's actual delivery.
Distinguish ready-for-host-delivery from delivered. Include concrete remaining
blockers; no complete/done claim while a required gate or repository is incomplete.

## Preview and apply

`--dry-run`/`--preview` uses the runtime preview contract and reports UNVERIFIED
PREVIEW. Tests on untouched source are baseline evidence only. `--apply` resumes the
exact existing preview journal, verifies unchanged base/cache and runs checks on
actual applied source through `apply-preview`; continue the ordinary review,
confidence and archive gates. Preview never grants shipping/backlog ownership.
