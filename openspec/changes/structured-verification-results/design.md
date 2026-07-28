---
change: structured-verification-results
type: design
---

# Design: Structured verification results

## Context

Verification already happens. Recording it does not.

```
 TODAY
 ─────
 sr-developer  Phase 4  ──►  "single full verification pass"
                              runs {{CI_COMMANDS_FULL}}  ← rendered EMPTY at install
                              reports failures as prose

 sr-reviewer   § Verification policy (scoped-first)
                 1. cheap whole-repo static checks
                 2. tests SCOPED to the diff
                 3. full suite only if it changed production code
                 4. else "the developer's full pass stands as the
                    pipeline's verification of record"
                              │
                              ├──► markdown report  ── SECURITY_STATUS: <…>   ← the ONE parsed token
                              │                       CI Checks table         ← rows are {{CI_CHECK_TABLE_ROWS}},
                              │                                                  stripped to empty
                              └──► confidence-score.json  ── overall + 5 aspect OPINIONS (0–100)
                                                            `test_coverage` = "is coverage adequate?",
                                                            NOT a count
```

Two consequences follow from that diagram.

**Nobody can read the result.** The only machine-parsed token in the reviewer's
entire output is `SECURITY_STATUS:`. A consumer wanting "did the tests pass, and
how many" has to scrape prose or trust an opinion score. specrails-desktop, which
now presents verification to non-technical reviewers in tiers by source, therefore
refuses to display any count at all: printing "68 tests passed" from prose would
turn a self-report into a measurement.

**Step 4 is the trap.** When the reviewer changed nothing and its scoped runs are
green, it does not re-run the suite — by design, and that design is what made the
pipeline affordable. So a large share of runs have no reviewer-executed full pass.
An artifact that emitted a bare `tests_passed: 14` would be read downstream as
"the suite is green" when it might mean "the fourteen tests covering the diff are
green, and the full suite was somebody else's pass". That is a worse failure than
having no artifact, because it looks authoritative.

Everything else needed already exists in the repo:

| Asset | Where | What it gives us |
|---|---|---|
| Per-runner JSON invocations | `templates/commands/specrails/health-check.md:137-145` | `jest --json`, `vitest run --reporter=json`, `mocha --reporter json`, `pytest -q`, `go test -v`, `cargo test`, `rspec --format json`, `dotnet test` |
| Metric vocabulary | `health-check.md:147` | `tests_total`, `tests_passed`, `tests_failed`, `tests_skipped`, `pass_rate`, `duration_seconds` |
| Artifact precedent | `changes/pipeline-cost-economy/specs/confidence-scoring/spec.md` | the emit + parity + consumer requirement trio, and `design-confidence.json` as an additive file whose absence preserves behaviour |
| Schema conventions | `schemas/profile.v1.json`, `CLAUDE.md` § schema identity | `<thing>.v<N>.json`, canonical `$id`, `additionalProperties: false`, `$id` ownership across repos |

## Goals / Non-Goals

**Goals**

- One machine-readable file per change recording what verification actually ran.
- Each entry states its SCOPE and its AUTHOR, so a scoped subset can never be
  mistaken for a full pass.
- Field names reused verbatim from `health-check.md` — no second vocabulary for
  the same measurements.
- A real JSON Schema with a canonical `$id`, so a downstream consumer validates
  rather than guesses.
- Absence is fully backward compatible.

**Non-Goals**

- No gate on the numbers. The confidence gate at Phase 4b-conf is untouched.
- No reconciliation of the two divergent `confidence-score.json` schemas
  (claude's `overall`/`aspects` vs the codex rail's `overall_score`/domain
  objects). That is a separate change; this artifact is additive to both.
- No coverage, lint, complexity or perf metrics, though `health-check.md` defines
  them. Tests first; the envelope has room for the rest later.
- No dependency on `{{CI_COMMANDS_FULL}}` or `{{CI_CHECK_TABLE_ROWS}}`. Both are
  stripped to empty by `renderPlaceholders` (`scaffold.ts:2972-2978`) since the
  enrich command was retired, so the agent must detect its own tooling exactly as
  `health-check.md` already instructs.

## Decisions

### D1 — A new artifact, not a new field on `confidence-score.json`

`confidence-score.json` is the reviewer's self-assessment: five opinions and
prose. Measured facts do not belong in the same file, because the whole value of
this work is that a consumer can tell the two apart. Mixing them would force
every reader to know which fields are measurements and which are judgements.

Precedent: `design-confidence.json` was added as its own file next to
`confidence-score.json` rather than as a section inside it.

**Alternative rejected** — extend `confidence-score.json` with a `verification`
object. Fewer files, but it collapses exactly the distinction the artifact exists
to make, and it would force a `schema_version` bump on a file two providers
already disagree about.

### D2 — Every entry declares scope and author

```json
{
  "check": "tests",
  "scope": "scoped",
  "ran_by": "reviewer",
  "status": "passed",
  "tool": "vitest",
  "command": "npx vitest run server/db.test.ts",
  "metrics": { "tests_total": 14, "tests_passed": 14, "tests_failed": 0,
               "tests_skipped": 0, "pass_rate": 100.0, "duration_seconds": 4.1 }
}
```

`scope` is `scoped | full`, `ran_by` is `reviewer | developer-pass-of-record`, and
`status` adds `not_rerun` to the usual `passed | failed`. A check the reviewer
deliberately did not re-run is RECORDED as `not_rerun` with null metrics rather
than omitted, because omission is indistinguishable from "the artifact is
incomplete", and a consumer must be able to say "the diff's tests are green; the
full suite was verified upstream".

**Alternative rejected** — emit only what the reviewer itself ran. Simpler, but
the common case (step 4) then produces an artifact that silently under-reports,
and a downstream "N tests passed" would describe a subset while looking total.

### D3 — Absent metrics are `null`, never `0`

A runner whose output could not be parsed yields `metrics: null` (or individual
nulls) with `status` still recorded. `tests_failed: 0` must mean "zero failures
were measured", never "we could not tell". This is the same rule the desktop
review packet enforces on its own display, and it only works if the producer
honours it too.

### D4 — A real JSON Schema, `schemas/verification-results.v1.json`

`openspec/specs/confidence-scoring.md:15` currently pins its artifact's schema by
reference to a `design.md` that lives only under `openspec/changes/archive/` — a
normative reference into an archived file. `schemas/` already ships in the package
`files` whitelist, and `CLAUDE.md` makes `$id` a cross-repo ownership contract.
So this artifact gets a schema file from the start rather than inheriting that
dangling-reference smell.

Note the repo's two versioning conventions: `schemas/profile.v1.json` uses numeric
`schemaVersion`, while run-time agent artifacts use the string
`"schema_version": "1"` (snake_case). The artifact follows the RUN-TIME precedent
(`confidence-score.json`, `design-confidence.json`); the schema FILE follows the
schema-file precedent.

### D5 — Registered in `integration-contract.json` (3.2 → 3.3)

The contract is the formal desktop↔core surface, and today it describes only
install/enrich — `grep confidence integration-contract.json` returns nothing. That
is why desktop's use of `confidence-score.json` is an informal convention
discovered by reading prompts. Registering this artifact's path and schema version
makes the count something a consumer can depend on. First run-time artifact to be
registered, hence the minor bump.

### D6 — The reviewer writes it; the developer's pass is recorded, not re-run

The reviewer is the only agent positioned to write the file: it runs last, it
knows what it re-ran, and it already writes `confidence-score.json` at the same
point. When step 4 applies, it records the developer's pass as an entry with
`ran_by: "developer-pass-of-record"` and whatever the developer reported —
faithfully, including "the developer reported green without a parseable count",
which is `status: "passed"` with `metrics: null`.

**Alternative rejected** — have the developer write its own artifact and the
reviewer merge them. More accurate in principle, but it doubles the surface, needs
a merge rule, and the developer's pass is exactly what the reviewer already has to
reason about.

## Risks / Trade-offs

- [The agent writes the file but improvises the runner invocation, since
  `{{CI_COMMANDS_FULL}}` is empty] → the spec requires the same per-runner
  detection `health-check.md` already specifies, quoted in the delta rather than
  referenced, so the instruction survives the stripped placeholder.
- [Counts parsed from human-readable output are still the agent's reading of
  stdout] → the artifact records `tool` and `command` alongside the metrics so a
  consumer can see WHAT produced the number; and the JSON-reporter invocations are
  preferred precisely because they remove the parsing judgement.
- [Two divergent confidence schemas mean the codex rail needs its own wiring] →
  the delta carries a provider-parity requirement, and the codex rail's existing
  free-text `tests: { ran, passed, details }` is upgraded to the shared metric
  shape rather than left to drift further.
- [A consumer trusts `scoped` counts as total anyway] → mitigated by making
  `scope` and `ran_by` REQUIRED, so a naive consumer cannot read metrics without
  parsing the qualifier that sits beside them.
- [Template changes are not retroactive] → projects keep emitting nothing until
  their framework updates; every consumer requirement therefore treats a missing
  file as the legacy path.

## Migration Plan

1. Ship `schemas/verification-results.v1.json` and the delta spec. Nothing emits
   yet, nothing consumes yet.
2. Add the output section to `templates/agents/sr-reviewer.md` (claude, and gemini
   and kimi which derive from it at install time), then the codex rail skill and
   the plugin copy. Each addition is inert until a project reinstalls.
3. Bump `integration-contract.json` to 3.3 with the artifact registered.
4. Desktop consumes it and promotes its test claim from ai-reported to
   app-verified when the file is present and its `scope`/`ran_by` allow the claim.

Rollback is deletion: no consumer requires the file, and the reviewer's existing
report and score are unchanged by its absence.

## Open Questions

- Should `verification-results.json` also carry the static checks the reviewer
  always runs (typecheck, lint, build)? The envelope allows it and
  `health-check.md` already names their metrics; this change scopes itself to
  tests to keep the first version small.
- Where does the artifact live for the codex rail, whose confidence file sits
  under `.specrails/agent-memory/explanations/` rather than
  `openspec/changes/<name>/`? The delta requires the openspec path where a change
  exists and permits the rail's own location otherwise; unifying the two is part
  of the deferred schema reconciliation.
