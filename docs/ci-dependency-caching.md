# CI dependency caching

How CI avoids re-downloading and re-resolving dependencies on every run, and why
the cache keys are shaped the way they are.

## What mise-action does and does not cache

`jdx/mise-action` caches the **tools** named in `.mise.toml` (node, python, uv,
just, gum). It does not cache anything those tools then install. That is why
"Setup mise" takes 3-5s while "Install dependencies" took 43-82s: every job was
downloading and building the whole npm tree and the whole Python environment from
scratch, every time.

## The three caches

| Cache | Path | Key | Jobs |
|---|---|---|---|
| npm download cache | `~/.npm` | `<os>-npm-<hash(frontend/package-lock.json)>` | frontend, e2e |
| frontend tree | `frontend/node_modules` | `<os>-node-modules-<hash(frontend/package-lock.json)>` | frontend, e2e |
| uv download cache | `~/.cache/uv` | `<os>-uv-<hash(backend/uv.lock)>` | backend, e2e, performance |
| Next.js build cache | `frontend/.next/cache` | `<os>-next-<hash(lock)>-<sha>` | frontend |

### Why `node_modules` has no `restore-keys`

Every other cache falls back to a prefix match, because a partially-stale
download cache is still useful: npm and uv verify integrity per package and
re-fetch what does not match. `node_modules` is different. A tree restored from a
*different* lockfile is not a faster starting point, it is a wrong answer that
can pass install and fail at runtime. So only an exact lockfile match is allowed,
and the install step is skipped only on `cache-hit == 'true'`, which `actions/cache`
sets only for an exact primary-key match.

### Why the E2E job no longer calls `just install`

`just install` is `install-backend` + `install-frontend` in one recipe, so as a
single workflow step it is all-or-nothing. The frontend half is the part a cache
hit can skip (it is ~85% of the time), and a combined step cannot be half-skipped.
The E2E job therefore calls the two halves as two steps and guards the frontend
one. `just install` remains the right entry point for humans.

The E2E job's `node_modules` key is deliberately identical to the frontend job's.
E2E `needs: frontend`, so on any run where the frontend job installed, E2E
restores the tree that job just saved rather than installing it a second time.

### Next.js build cache

Keyed by lockfile plus commit SHA so each run writes its own entry, with
`restore-keys` falling back to the newest entry for the same lockfile. The cache
is content-addressed, so restoring a slightly stale one is safe: Next revalidates
and reuses what still matches. It is saved before `Build` runs, which is what
makes the entry a restore of the *previous* run's cache rather than a no-op
save of this run's.

## Busting the caches

Every key carries a version segment, `${{ vars.CI_CACHE_VERSION || 'v1' }}`:

```
Linux-npm-v1-<hash(frontend/package-lock.json)>
```

To invalidate every cache at once, set or bump the repository variable
`CI_CACHE_VERSION` (Settings -> Secrets and variables -> Actions -> Variables),
e.g. to `v2`. Nothing needs committing, and the next run of every job misses on
every key and repopulates. The variable does not have to exist: unset, the
expression falls back to `v1`. Reach for this when a cache has gone bad in a way
the lockfile hash cannot see, such as a corrupted entry or a change in runner
image that invalidates a native build.

The `restore-keys` prefixes include the version segment too, so a bump is not
quietly undone by a prefix match against the old generation.

## Ignoring the caches for one run

The workflow also accepts a manual `workflow_dispatch` with a `no_cache`
boolean. Run CI from the Actions tab with it checked and every cache step is
skipped (`if: inputs.no_cache != true`), so the installs run uncached. Use it to
time a cold install, or to rule the caches out while debugging a failure, without
touching the repository variable and without affecting anyone else's runs.

Two details make this work. The install steps gate on
`steps.node-modules.outputs.cache-hit != 'true'`, and a skipped cache step
produces no output, so the empty value correctly reads as "not cached" and the
install runs. And the frontend and backend jobs add
`|| github.event_name == 'workflow_dispatch'` to their conditions, because
`paths-filter` has no base commit to diff against on a manual run and reports no
changes — without that clause a `no_cache` dispatch would skip the very jobs it
is meant to time.

## The paths filter has to include the build system

`dorny/paths-filter` decides whether the frontend and backend jobs run at all.
Those filters originally listed only `frontend/**` and `backend/**`, which meant a
PR editing `justfile`, `.just/**`, `.mise.toml` or `ci.yaml` itself skipped both
jobs — including a PR that changes how they install their dependencies. The
breakage then surfaced on the push to main, where the `|| github.ref ==
'refs/heads/main'` clause forces the jobs to run.

This caching work found that the practical way: the first run of the branch
skipped Frontend and Backend entirely. The build-system paths are now listed
under both filters.

## npm install vs npm ci

`just install-frontend` runs `npm install` locally and `npm ci` when `CI` is set.
Locally `npm install` is correct: it updates `package-lock.json` when
`package.json` changes. In CI that resolve pass is pure cost, and a CI run must
never rewrite the lockfile. `just install-backend` does the same thing with
`uv sync --all-extras --frozen`: `--frozen` installs exactly what `uv.lock` says
and never re-resolves.

## Pinning

Every action is pinned to a full commit SHA with the version in a trailing
comment, which is what the Scorecard `Pinned-Dependencies` check requires. When
bumping, resolve the SHA from the tag and confirm it is a **commit**, not an
annotated tag object, or the pin will not match what Scorecard expects:

```bash
gh api repos/actions/cache/git/ref/tags/v4.3.0 --jq '.object.sha + " " + .object.type'
```
