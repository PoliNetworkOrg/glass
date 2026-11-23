# Releasing

Every push to `main` runs [`release.yaml`](../.github/workflows/release.yaml). It lints, builds the package and the
demo, works out the next version from the commit messages with [semantic-release](https://semantic-release.gitbook.io),
publishes `@polinetwork/glass` to npm through trusted publishing, and creates a GitHub release. Nobody publishes by
hand, and no npm token is stored.

Pull requests run [`ci.yaml`](../.github/workflows/ci.yaml), the same checks without the release.

This follows the setup of the `backend` and `auth-kit` repositories:

| Setting                                    | Why                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `pkgRoot: "packages/glass"`                | The root package is the demo, which is private; only the library is published         |
| `conventionalcommits` preset               | It understands `feat!:` as a breaking change, as `backend` does                       |
| Breaking changes bump the minor version    | The package stays on `0.x` for now, as `auth-kit` does                                |
| Lint and builds run before release         | A red `main` never publishes                                                          |
| Full git history is checked out            | semantic-release needs every tag and commit since the last release                    |

The `version` in [`packages/glass/package.json`](../packages/glass/package.json) stays `0.0.0` in git. semantic-release
writes the real version into the package just before publishing; the git tags are the source of truth.

## Commit messages

Versions come from [Conventional Commits](https://www.conventionalcommits.org) on `main`. With squash merges, the PR
title is the commit message; with merge commits, every commit in the PR counts.

| Commit                                                  | Release while on `0.x` | Release from `1.0.0` |
| ------------------------------------------------------- | ---------------------- | -------------------- |
| `fix: …`, `perf: …`                                     | patch                  | patch                |
| `feat: …`                                               | minor                  | minor                |
| `feat!: …` or a `BREAKING CHANGE:` footer               | minor                  | major                |
| `docs:`, `chore:`, `ci:`, `refactor:`, `deps:`, …       | none                   | none                 |

Consumers depend on `^0.N.x`. For `0.x`, npm's caret already stays within one minor version, so a breaking minor
release never reaches them without a dependency bump.

## One-time setup

Do these in order: merging into `main` starts a release immediately.

1. **Configure trusted publishing on npm** for `@polinetwork/glass` (the package exists, at `0.1.0`): on npmjs.com,
   package settings → Trusted publishing → GitHub Actions, organization `PoliNetworkOrg`, repository `glass`, workflow
   `release.yaml`, no environment. Then set publishing access to disallow tokens.

2. **Check that the workflow may write to the repository.** It requests `contents: write` to push tags and create
   releases. This works unless the organization's Actions policy restricts workflow permissions.

3. **Push the baseline tag before merging.** Without a tag, semantic-release's first release is always `1.0.0`. The tag
   `v0.1.0` marks the commit that was published by hand as `0.1.0` (`7e25385`, "Initial commit"), so the first
   automatic release is `0.2.0`:

   ```sh
   git tag v0.1.0 7e25385
   git push origin v0.1.0
   ```

A failed release does no harm: fix the setup and rerun the job.

## Going to 1.0.0

1. Remove the `releaseRules` entry from [`release.config.mjs`](../release.config.mjs).
2. Merge a commit with a `BREAKING CHANGE:` footer (it may be the same commit). semantic-release then publishes `1.0.0`.
