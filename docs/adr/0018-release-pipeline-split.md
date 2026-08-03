# Release pipeline split

Releases have exactly one writer: `build.yml`, triggered by a pushed semver tag, builds the platform artifact matrix, signs what it can, attaches artifacts plus SHA256SUMS to a GitHub Release, and publishes the npm package. `release.yml` is reduced to version-bump + tag only. The earlier design had `release.yml` create the release in the same run that tagged — two workflows touching GitHub Releases race and can clobber each other; splitting keeps tag creation (human-initiated) separate from release writing (automated).
