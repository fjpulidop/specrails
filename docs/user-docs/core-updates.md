# Core installation and update consistency

`specrails-core init` and `specrails-core update` use the version of the package
that actually provides the CLI. Updating an npm package and updating a workspace
are separate operations: run the selected CLI's `update --root-dir <repository>`
to refresh that project's managed artifacts. `--provider` selects the additional
provider to include; existing managed provider selections are preserved and
reassembled, including in-repository copies and Windows copy fallbacks. Provider
inventory is checked against installed Core artifacts; an unrelated directory
containing only user files is not enrolled automatically.

Core 5 installation is deterministic. It installs the baseline roles, commands,
OpenSpec integration and declared local execution helper without an AI enrichment
phase. `integration-contract.json` describes the supported lifecycle and providers.

## Version and rollback rules

A CLI older than the workspace marker or shared active framework refuses ordinary
init/update. This protects an updated installation from an old global executable.
Use the intended Core package rather than editing a version marker to bypass the
check. Low-level explicit pointer changes are administrative rollback operations;
they do not imply that project copies have been restored.

Managed framework bytes are generated in an isolated staging directory, validated
and stamped before publication. The content/source hashes include the compiled
pipeline helper, so a same-version development rebuild is repaired when runtime
bytes change. The previous framework directory is retained as
`.previous-<version>-<id>` for recovery. A failed generation leaves the active
framework untouched.

Init/update snapshot the managed workspace surfaces and framework pointer. Failure
restores those snapshots, including symlinks, and does not publish a successful
workspace version or Core-owned registry version. If restoration itself fails,
the error identifies the retained backup for recovery. Reserved custom agents
stay in place during rollback: edits, new custom files and deliberate deletions
made while OpenSpec runs are preserved. Profiles remain outside the snapshot
surfaces; provider configuration is restored with the managed workspace snapshot.

A separate framework lifecycle lock covers admission, version revalidation,
snapshots, asynchronous OpenSpec provisioning and final commit or rollback. The
same lock protects Desktop's low-level install-framework, swap-current and
assemble commands. A concurrent operation fails immediately with a retry message
instead of waiting while holding another lock. This prevents a failed installer
from rolling back a framework that a second installer already reported as ready.
A positively dead process owner can be recovered; concurrent recovery attempts
are serialized, and an unidentified or live owner is never taken over.

`update --dry-run` reports the intended change without allocating or rewriting
registry entries. Partial `--only rules` or `--only agents` refreshes do not claim
that the entire framework has moved to the executing CLI's version. The returned
`installedVersion` describes the actual workspace marker.

The low-level `install-framework --version` command requires the requested label
to match the package version supplying its bytes. `assemble --version` requires
the matching complete active framework before recording that version in a project.

## Desktop

Desktop keeps the selected package and its dependencies after an update. Its
Settings page reports runtime, framework, bundled and latest-known versions
separately. Partial workspace migration remains pending across restart and can be
retried using the retained package offline. A CLI installed outside Desktop can
also be discovered through PATH; an explicit `SPECRAILS_CORE_BIN` takes precedence.

Changes in this branch require a Core package build and distribution before an
already installed Desktop can consume them. The source changes alone do not
upgrade any user installation or publish a new package.

See [Provider pipeline contracts](provider-pipelines.md) for the resumable
implementation journal and verification behavior.
