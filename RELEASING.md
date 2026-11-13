# Releasing footprint-storydeck

A release is a pull request that raises the version. Merging it is the release: one shared route
(`.github/workflows/publish.yml`, which calls `footprintjs/ci`) builds the package, checks the file,
publishes that exact file to npm, proves npm serves the same bytes, and only then writes the tag
`v<version>` and the GitHub release. The steps, and why each one is there, are in
`docs/RELEASE-ROUTE.md` of `footprintjs/ci`. What differs for this package (Node, system packages,
checks, what the tarball may hold, the changelog style) is `.github/release.json`.

## To release

1. In a pull request, raise `version` in `package.json` (and in `package-lock.json`) and write that
   version's section in `CHANGELOG.md`: a heading `## <version> — <title>`, written once. The
   "Release check" on the pull request says "would publish x.y.z", or names what is missing.
2. Merge it. The push to `main` runs "Publish to npm" as `publish`: plan, hold check, build, publish,
   verify, release. Any push to `main` that raises the version releases it, whether or not it came
   through a pull request; `main` is not protected today, so "a release is a pull request" is a rule
   we keep, not one GitHub enforces.
3. Read the run. The plan's summary says what it decided and why; verify says npm serves the bytes the
   run built; the release job writes the tag and the GitHub release.

Never create the GitHub release or the tag by hand, except in the two cases where the route's table
tells you to: the route does both, after it has proved the bytes on npm. A push to `main` publishes
nothing when the current version is already tagged and on npm ("nothing to do: the version is tagged
and on npm"). If a raised version failed to publish (a red build, a hold), the next push to `main`
publishes it, also one that does not touch the version, and that is how a fix gets it out.

## To try without publishing

Actions, "Publish to npm", "Run workflow", action `dry-run` (the default), from any branch. It plans,
builds and, for a version npm already has, compares the rebuild with npm. Nothing is published, tagged
or released (the run keeps the built package for 30 days and its records for 90, as run artifacts).

A dry run of a version that is already released compares the rebuild with what npm serves, so it is
red at `verify` with `registry-differs` whenever a file that ships (for example `package.json` or
`README.md`) has changed since that release. Between releases that is the normal state, not a fault:
read the plan, hold and build jobs.

## To hold a release

Label any open issue or pull request `hold-release` (the label exists in this repository). To lift
it, remove the label or close the item. The route checks it before the build and again directly
before publishing; details in `footprintjs/ci` `docs/HOLD.md`.

## When a run is red

Read the plan's summary first: every stop names its reason. What to do for each case (re-run failed
jobs, never re-run all jobs after the build was green, a stray tag, a late npm) is the table "When
something fails" in `footprintjs/ci` `docs/RELEASE-ROUTE.md`; it is kept there once, not copied here.

## Changing the route

The route is pinned to one full commit of `footprintjs/ci` in two files: `.github/workflows/publish.yml`
and `.github/workflows/release-check.yml`. Moving the pin is a reviewed pull request that changes both
to the same commit.
