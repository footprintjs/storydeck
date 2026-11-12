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
   verify, release.
3. Read the run. The plan's summary says what it decided and why; verify says npm serves the bytes the
   run built; the release job writes the tag and the GitHub release.

Never create the GitHub release or the tag by hand: the route does both, after it has proved the
bytes on npm. A push to `main` that does not raise the version publishes nothing ("nothing to do: the
version is tagged and on npm"), so a fix without a new version is safe to merge.

## To try without publishing

Actions, "Publish to npm", "Run workflow", action `dry-run` (the default), from any branch. It plans,
builds and, for a version npm already has, compares the rebuild with npm. Nothing is written anywhere.

## When a run is red

Read the plan's summary first: every stop names its reason. What to do for each case (re-run failed
jobs, never re-run all jobs after the build was green, a stray tag, a late npm) is the table "When
something fails" in `footprintjs/ci` `docs/RELEASE-ROUTE.md`; it is kept there once, not copied here.

## Changing the route

The route is pinned to one full commit of `footprintjs/ci` in two files: `.github/workflows/publish.yml`
and `.github/workflows/release-check.yml`. Moving the pin is a reviewed pull request that changes both
to the same commit.
