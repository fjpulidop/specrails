# Codex and Claude Code execution

Both providers support the SpecRails design, implementation, review and archive
workflow. Their adapters differ; native role APIs and conversation memory are not
interchangeable.

| Concern | Claude Code | Codex |
|---|---|---|
| Role definitions | `.claude/agents/sr-*.md` | `.codex/skills/rails/sr-*/SKILL.md` |
| Workflow entry | `/specrails:implement` | `$implement` |
| Multiple tickets | Aggregate change and shared journal | Routes directly to `$batch-implement` |
| Retry | Durable pipeline journal | Same journal, direct role calls; no nested coordinator |
| Role models | Configured role/profile model | Inherited model on full-history forks; overrides require a compatible native transport |
| Verification | Scoped development checks and candidate-bound full gate | Same evidence contract |
| Hosted worktrees/delivery | Owned by the host | Owned by the host |

The installed `.specrails/runtime/pipeline.mjs` helper coordinates both providers.
Its execution context identifies the frozen specs, repositories, shared backlog,
OpenSpec artifact root and ownership. Skills must not infer those roots from cwd.

A completed process is not an implementation verdict. Design confidence, checked
tasks, semantic review, fresh verification and an authorized archive are required
before success. See [provider pipeline contracts](provider-pipelines.md).
