# Sakariheitaja agent instructions

## Shared workflow

Read this repository's README.md. When checked out under
`sakke-workspace/repos/sakariheitaja`, also read the workspace AGENTS.md and its
referenced `.agents/` modules. They own the shared ticket, development, style,
verification, and PR workflow; this file adds bot-specific constraints.

For a standalone checkout, obtain the workspace instructions from the owner's
sakke-workspace checkout before development rather than inventing a workflow.
This repository's default branch is `master`; verify it before branching.

## Compatibility and design

- Preserve existing data compatibility and historical score records. Never drop
  production tables or replace production data as part of development.
- Schema changes require an explicit, reviewed migration plan covering existing
  data, compatibility, verification, and recovery. The owner performs production
  operations; do not dump or re-import production data without authorization.
- Prefer incremental refactoring over rewrites. Preserve existing behavior
  unless the ticket explicitly changes it; clarify ambiguous data-model changes.
- Keep polling, external-data parsing, score-change detection, commentary, and
  persistence responsibilities separate. Prefer pure deterministic score/event
  calculations with behavior-focused tests and explicit I/O boundaries.
- Derive commentary facts from available scoring data. Do not invent throw-level
  events that the source does not provide.
- Use the shared TypeScript style rules, typed inputs/results, and runtime
  validation of external data. Avoid hidden mutable state and tight coupling.

## Verification and deployment

Use package.json and `.github/workflows/ci.yml` for current checks and runtime
versions, not historical test counts. Docker deployment is managed by the
workspace compose stack. Do not start the bot against real Telegram, Metrix,
Ollama, or database services as an automated check. The owner performs deployment
and live verification using the PR's testing instructions.
