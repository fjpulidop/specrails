# Proposal: Structured verification results

## Why

The pipeline runs tests, but it never records what they said in a form anything can read.

The reviewer's only machine-parsed token is `SECURITY_STATUS:` (`templates/agents/sr-reviewer.md:220`). Test outcomes live in a free-prose markdown table whose rows are the `{{CI_CHECK_TABLE_ROWS}}` placeholder — which `renderPlaceholders` (`src/installer/phases/scaffold.ts:2972-2978`) strips to **empty** at install time, so the shipped agent improvises both the commands and the rows. The one structured reviewer artifact, `confidence-score.json`, carries five self-assigned 0–100 opinions; its `test_coverage` aspect is a judgement about *adequacy*, not a count.

The consequence is concrete and already visible downstream. specrails-desktop's review packet splits verification proof into three tiers by source — measured-by-the-app, reported-by-the-AI, and the AI's own self-assessment — and deliberately **refuses to print any test count at all**, because scraping "68 tests passed" out of prose would launder a self-report into a measurement. A non-technical reviewer therefore gets "the AI reports its verification passed" where they could be getting "312 of 312 tests passed, 4.1s".

Everything needed to fix this already exists in this repo, in the wrong place:

- `templates/commands/specrails/health-check.md:137-147` already specifies the per-runner machine-readable invocations (`jest --json`, `vitest run --reporter=json`, `mocha --reporter json`, `pytest --tb=no -q`, `go test -v`, `cargo test`, `rspec --format json`, `dotnet test`) **and** the exact metric names: `tests_total`, `tests_passed`, `tests_failed`, `tests_skipped`, `pass_rate`, `duration_seconds`.
- `templates/codex-skills/rails/sr-reviewer/SKILL.md` already asks the codex reviewer to "capture the count" — and then puts it in a free-text `tests.details` field ("14/14 passing").

So the intent and the vocabulary are both written down already. Only the structure is missing.

**Scoped verification is NOT part of this proposal — it already shipped.** `sr-reviewer.md:66-74` § "Verification policy (scoped-first)" and the developer's single full pass landed with `pipeline-cost-economy` in 5.0.0. That policy is precisely *why* this change is delicate: step 4 says that when the reviewer changed nothing and its scoped runs are green, "the developer's full pass stands as the pipeline's verification of record". A large fraction of runs therefore have **no reviewer-executed full suite**, and an artifact that reported a scoped subset as if it were the whole suite would be worse than no artifact at all.

## What Changes

1. **Verification-results artifact** (new `verification-results` capability). After its verification policy completes, the reviewer writes `${SPECRAILS_REPO_DIR:-.}/openspec/changes/<name>/verification-results.json`: a `schema_version: "1"` envelope carrying one entry per check it actually ran, with the health-check metric names reused verbatim. Every entry declares **who ran it** (`reviewer` | `developer-pass-of-record`) and **what scope** (`scoped` | `full`), and a check the reviewer did not re-run is recorded as `not_rerun` rather than omitted or inferred. Absent metrics are `null`, never zero.

2. **Real JSON Schema** (`schemas/verification-results.v1.json`). Today `openspec/specs/confidence-scoring.md:15` pins its artifact's schema by reference to a design doc that now exists only under `openspec/changes/archive/`, and `schemas/` contains only `profile.v1.json`. This artifact gets a normative schema with a canonical `$id`, following the `$id`-ownership rule in `CLAUDE.md`, so a downstream consumer validates instead of guessing.

3. **Registered as a cross-repo contract** (`integration-contract.json`, `schemaVersion` 3.2 → 3.3). The contract today describes only the install/enrich surface and mentions no run-time artifact, which is why desktop's consumption of `confidence-score.json` is an informal convention. Registering the artifact's path and schema version makes the count something a consumer can rely on rather than discover.

**Parity.** The reviewer's output contract lives in four template families and all four move together: `templates/agents/sr-reviewer.md` (claude, and gemini/kimi which derive from it at install time via `placeGeminiAgents` / `writeKimiWorkflowSkill`); `templates/codex-skills/rails/sr-reviewer/SKILL.md` (whose existing `tests: { ran, passed, details }` field is upgraded to the shared metric shape); `templates/commands/specrails/implement.md` (the orchestrator's Phase 4b/4e reporting); and `specrails-plugin/agents/reviewer.md` (the marketplace copy, which also lacks the `${SPECRAILS_REPO_DIR:-.}` wrapper and gains it here).

**Explicitly out of scope.** No gate on the new numbers — the confidence gate at Phase 4b-conf stays exactly as it is; a failing count already surfaces through the existing sentinel and the reviewer's report. No reconciliation of the two divergent confidence-score schemas (claude's `overall`/`aspects` vs the codex rail's `overall_score`/domain sub-objects); that is its own change. No coverage, lint or complexity metrics, even though `health-check.md` defines them — tests first.

## Impact

**Affected specs:** new `verification-results` capability. `confidence-scoring` and `implement` are deliberately untouched: this is an additive artifact alongside `confidence-score.json`, not a change to what scoring means or to when the pipeline gates.

**Affected code:**
- `templates/agents/sr-reviewer.md` — new "Verification Results" output section; the report table gains a machine-readable sibling rather than replacing it.
- `templates/codex-skills/rails/sr-reviewer/SKILL.md` — `tests` upgraded to the shared metric shape.
- `templates/commands/specrails/implement.md` — Phase 4e surfaces the counts when the file exists.
- `specrails-plugin/agents/reviewer.md` — parity + the missing repo-dir wrapper.
- `schemas/verification-results.v1.json` — new (already shipped by the `files` whitelist).
- `integration-contract.json` — `schemaVersion` bump + artifact registration.

**Backward compatibility.** `verification-results.json` is a new additive artifact; absence preserves pre-change behaviour byte-for-byte. Consumers that do not know about it are unaffected, and a consumer that does (desktop's review packet) keeps presenting the sentinel as a self-report until the file appears — at which point the same claim becomes measured, with its scope and its author stated.

**Meta-tool impact.** These are template changes, so they reach target repos only on install/update and are not retroactive: a project scaffolded before this ships keeps emitting no verification artifact until its framework is updated.
