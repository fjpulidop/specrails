# Delta Spec: verification-results

## ADDED Requirements

### Requirement: Reviewer emits a structured verification-results artifact

The reviewer agent SHALL write `${SPECRAILS_REPO_DIR:-.}/openspec/changes/<name>/verification-results.json`
after completing its verification policy and before reporting its results,
containing `schema_version` (`"1"`), `change` (the kebab-case change name),
`agent` (`"reviewer"`), `recorded_at` (ISO 8601), and `checks`: an array with one
entry per verification check the pipeline performed. The file SHALL conform to
`schemas/verification-results.v1.json`. Writing it SHALL NOT be conditional on
the outcome — a failed verification is exactly the case a consumer most needs
recorded.

#### Scenario: Reviewer runs the tests scoped to the diff

- **WHEN** the reviewer runs the test files covering the changed sources and they pass
- **THEN** the artifact SHALL contain a `tests` entry with `scope: "scoped"`, `ran_by: "reviewer"`, `status: "passed"`, the `tool` and `command` used, and the measured metrics

#### Scenario: Verification fails

- **WHEN** any check the reviewer ran reported failures
- **THEN** that entry SHALL carry `status: "failed"` with the measured failure count, and the artifact SHALL still be written

#### Scenario: Change name cannot be determined

- **WHEN** the reviewer cannot resolve the active change directory
- **THEN** it SHALL write the artifact with `change: "unknown"` and record why in `notes`, mirroring the existing `confidence-score.json` behaviour

### Requirement: Every check declares its scope and its author

Each entry in `checks` SHALL declare `scope` (`"scoped"` | `"full"`) and `ran_by`
(`"reviewer"` | `"developer-pass-of-record"`). A check the reviewer deliberately
did not re-run SHALL be recorded with `status: "not_rerun"` rather than omitted.
A consumer SHALL therefore never be able to read a metric without the qualifier
that bounds it.

#### Scenario: Reviewer relies on the developer's full pass

- **WHEN** the reviewer changed no production code, its scoped runs are green, and it does not re-run the suite
- **THEN** the artifact SHALL record the full-suite entry with `ran_by: "developer-pass-of-record"` and whatever the developer reported
- **AND** the reviewer's own scoped run SHALL appear as a separate entry with `scope: "scoped"`, `ran_by: "reviewer"`

#### Scenario: A check was skipped entirely

- **WHEN** a check neither the reviewer nor the developer performed is relevant to the change
- **THEN** it SHALL appear with `status: "not_rerun"` and `metrics: null`, never be silently absent

#### Scenario: Consumer distinguishes a subset from the whole suite

- **WHEN** a consumer reads an entry whose `scope` is `"scoped"`
- **THEN** the artifact SHALL provide no basis for presenting that count as the full suite's result

### Requirement: Metrics are measured, and absent metrics are null

Test metrics SHALL use the field names already established by the health-check
command: `tests_total`, `tests_passed`, `tests_failed`, `tests_skipped`,
`pass_rate` (0.0–100.0) and `duration_seconds`. The reviewer SHALL prefer each
runner's machine-readable invocation — `jest --json`, `vitest run --reporter=json`,
`mocha --reporter json`, `pytest --tb=no -q`, `go test ./... -v`, `cargo test`,
`rspec --format json`, `dotnet test` — detected from the project's own
configuration. A metric that could not be measured SHALL be `null`; zero SHALL
mean a measured zero.

#### Scenario: Runner exposes a JSON reporter

- **WHEN** the project's test tool has a machine-readable reporter
- **THEN** the reviewer SHALL use it and populate every metric it reports

#### Scenario: Counts cannot be parsed

- **WHEN** the reviewer ran a check but could not extract counts from its output
- **THEN** `metrics` SHALL be `null` while `status`, `tool` and `command` are still recorded
- **AND** `tests_failed` SHALL NOT be set to `0` to represent an unknown result

#### Scenario: No test tooling exists

- **WHEN** the project has no detectable test runner
- **THEN** the `tests` entry SHALL record `status: "not_rerun"` with a note stating no runner was detected, rather than being omitted

### Requirement: The artifact does not depend on install-time placeholders

The reviewer's instructions for detecting tooling and invoking runners SHALL be
self-contained. They SHALL NOT rely on `{{CI_COMMANDS_FULL}}`,
`{{CI_COMMANDS}}`, or `{{CI_CHECK_TABLE_ROWS}}` being populated, because the
installer's placeholder renderer strips every unresolved `{{UPPER_CASE}}` token
to an empty string.

#### Scenario: Installed agent has empty CI placeholders

- **WHEN** the installed agent definition contains no enumerated CI commands
- **THEN** the reviewer SHALL still detect the project's tooling and produce the artifact

### Requirement: Provider parity for verification results

Every provider surface that runs a reviewer SHALL emit the artifact with the same
field names and the same scope/author semantics: the claude agent definition
(from which the gemini and kimi definitions are derived at install time), the
codex rail reviewer skill, and the marketplace plugin copy. Where a provider's
reviewer already records test information in another shape, that shape SHALL be
migrated to these metrics rather than left to diverge.

#### Scenario: Codex rail reviewer

- **WHEN** the codex rail reviewer completes its checks
- **THEN** its confidence artefact's test information SHALL use the shared metric field names, scope and author
- **AND** it SHALL write `verification-results.json` under the change directory when one exists, or alongside its own artefact when it does not

#### Scenario: Plugin copy stays in step

- **WHEN** the marketplace plugin's reviewer runs
- **THEN** it SHALL emit the same artifact, resolving its path through the repo-dir indirection like every other template

### Requirement: A missing artifact preserves existing behaviour

The artifact SHALL be additive. Its absence SHALL NOT change the reviewer's
report, the confidence score, the confidence gate, or any command's exit status,
and consumers SHALL treat absence as "verification was not recorded" rather than
as failure.

#### Scenario: Project installed before this change

- **WHEN** a project's framework predates the artifact and no file is written
- **THEN** the pipeline SHALL behave byte-for-byte as it did before

#### Scenario: Consumer finds no artifact

- **WHEN** a consumer looks for the artifact and it is absent
- **THEN** it SHALL fall back to whatever it presented before, without reporting an error

### Requirement: The artifact schema has a canonical, owned identity

`schemas/verification-results.v1.json` SHALL declare a `$id` under the
specrails-core repository, set `additionalProperties: false`, and require
`schema_version`, `change`, `agent`, `recorded_at` and `checks`. A downstream tool
vendoring a diverging copy SHALL give it a distinct `$id`. The artifact's path and
schema version SHALL be registered in `integration-contract.json` so consumers
depend on a declared contract rather than on reading agent prompts.

#### Scenario: Consumer validates an artifact

- **WHEN** a consumer validates a produced artifact against the published schema
- **THEN** validation SHALL pass, and an unknown field SHALL be rejected

#### Scenario: Contract declares where to look

- **WHEN** a consumer reads `integration-contract.json`
- **THEN** it SHALL find the artifact's path template and schema version without inspecting any template
