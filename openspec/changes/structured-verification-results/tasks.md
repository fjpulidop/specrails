# Implementation Tasks

## 1. Schema and contract

- [ ] 1.1 `schemas/verification-results.v1.json`: new JSON Schema following the `profile.v1.json` conventions (`$schema` draft 2020-12, canonical `$id` under `specrails-core/main/schemas/`, `title`/`description` naming producer and consumers, `additionalProperties: false`). Required: `schema_version` (const `"1"`), `change`, `agent`, `recorded_at`, `checks`. Each check requires `check`, `scope` (`scoped|full`), `ran_by` (`reviewer|developer-pass-of-record`), `status` (`passed|failed|not_rerun`); optional `tool`, `command`, `notes`, and `metrics` which is either `null` or an object of `tests_total`, `tests_passed`, `tests_failed`, `tests_skipped`, `pass_rate`, `duration_seconds` — each individually nullable.
- [ ] 1.2 `integration-contract.json`: bump `schemaVersion` 3.2 → 3.3 and register the artifact (path template `openspec/changes/<name>/verification-results.json`, schema file, schema version). First run-time agent artifact in the contract — document that in the entry.
- [ ] 1.3 `src/installer/__tests__/`: assert the schema file is valid JSON Schema, that its `$id` matches its path, and that `additionalProperties` is false (mirrors how `profile.v1.json` identity is policed).

## 2. Claude reviewer (source of truth for gemini + kimi)

- [ ] 2.1 `templates/agents/sr-reviewer.md`: new `## Verification Results` section after `## Confidence Scoring`, specifying the artifact path with the `${SPECRAILS_REPO_DIR:-.}` wrapper, the required fields, and a worked example. State that writing it is non-optional and independent of outcome.
- [ ] 2.2 `templates/agents/sr-reviewer.md`: inline the per-runner machine-readable invocations (copied from `templates/commands/specrails/health-check.md:137-145`) and the metric names, so the instruction survives `{{CI_COMMANDS_FULL}}` being stripped to empty. Add the explicit rules: prefer the JSON reporter; unmeasured ⇒ `null`, never `0`; no runner detected ⇒ `status: "not_rerun"` with a note.
- [ ] 2.3 `templates/agents/sr-reviewer.md`: tie the artifact to the existing § "Verification policy (scoped-first)" — each entry carries `scope` and `ran_by`, and policy step 4 (developer's pass of record) is recorded as its own entry rather than presented as the reviewer's own run.
- [ ] 2.4 Verify no new `{{PLACEHOLDER}}` token was introduced (`.claude/rules/templates.md`: every placeholder documented, none left unresolved after render).

## 3. Provider parity

- [ ] 3.1 `templates/codex-skills/rails/sr-reviewer/SKILL.md`: replace the free-text `tests: { ran, passed, details }` field with the shared metric shape (`scope`, `ran_by`, `status`, `tool`, `command`, `metrics`), and write `verification-results.json` under the change directory when one exists, else alongside its existing confidence artefact.
- [ ] 3.2 `specrails-plugin/agents/reviewer.md`: same section as 2.1–2.3, and add the missing `${SPECRAILS_REPO_DIR:-.}` wrapper its `confidence-score.json` path also lacks.
- [ ] 3.3 `templates/commands/specrails/implement.md`: Phase 4e surfaces the recorded counts in its summary table when the artifact exists, showing scope and author alongside; absent ⇒ the table renders exactly as today.
- [ ] 3.4 Confirm gemini and kimi need no separate edit (both derive from `templates/agents/` at install time via `placeGeminiAgents` / `writeKimiWorkflowSkill`) and note it in the change.

## 4. Guard rails

- [ ] 4.1 `src/installer/__tests__/template-repo-dir.test.ts`: extend so the new artifact path is covered by the existing repo-dir-wrapper invariant.
- [ ] 4.2 New template-content test: every reviewer surface (claude agent, codex rail skill, plugin copy) mentions `verification-results.json` and the `not_rerun` status, so a future edit cannot drop one provider silently.
- [ ] 4.3 Assert the metric names in the reviewer template match those in `health-check.md` — one vocabulary, enforced rather than remembered.

## 5. Validation gate

- [ ] 5.1 `npm run build && npm run typecheck` pass.
- [ ] 5.2 `npx vitest run` passes, including the new schema and template-content tests.
- [ ] 5.3 `npm run dogfood` (`init --yes`) produces an installed reviewer whose Verification Results section is fully rendered — no empty placeholder skeleton, unlike today's stripped CI table.
- [ ] 5.4 Acceptance sweep: `grep -rl 'verification-results' templates/ specrails-plugin/ schemas/ integration-contract.json` lists every surface this change claims to touch.

## 6. Cross-repo (separate PR, non-blocking)

- [ ] 6.1 specrails-desktop: read the artifact at settle in `server/delivery-evidence.ts` alongside `confidence-score.json`, and promote the review packet's test claim from the `ai-reported` tier to `app-verified` ONLY when `scope`/`ran_by` justify it. A `scoped` count stays qualified in the UI; the packet already refuses to print an unsourced number, so the change is additive on that side too.
