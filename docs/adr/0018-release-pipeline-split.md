# Release pipeline split

Releases have exactly one writer: `build.yml` builds the platform artifact matrix, signs what it can, attaches artifacts plus SHA256SUMS to a GitHub Release, and publishes the npm package. `release.yml` is reduced to version-bump + tag only.

## Amendment (CI hardening)

The handoff is now `workflow_dispatch`: `release.yml` ends by dispatching `build.yml` on the fresh tag. Rationale: tag pushes made with the default `GITHUB_TOKEN` never trigger other workflows (documented GitHub behavior), so the original `push: tags` trigger could not fire — a silent dead end. `workflow_dispatch` is the documented exception that always creates a run, and `build.yml` remains the only writer of the GitHub Release, so the original no-race constraint is preserved. The tag trigger is kept as a manual fallback for PAT pushes; the version is derived from the dispatch input or the tag ref.
