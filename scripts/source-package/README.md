# Checked source-package retention

This CI adapter retains one original source-version package after the existing coverage,
build, dist-door and publint checks. It never rebuilds, changes a manifest/version, installs
a consumer, publishes or claims downstream compatibility.

```mermaid
flowchart LR
  checks[Existing native checks] --> pack[One offline scripts-off pack]
  pack --> inspect[Shared pinned release archive inspector]
  inspect --> bind[Bind every member to Git source or checked dist bytes]
  bind --> retain[Original archive + source manifests + candidate receipt]
```

`source-package.mjs` wires the adapter. `retain.mjs` owns the single pack and fresh output;
`files.mjs` reads immutable Git documents and regular build files; `receipt.mjs` admits data.
The shared inspector at ci `1ca5d7de9bde68c205b5d140c94dc475ae3b2520` owns the closed
gzip/tar reader and this repository's unchanged `.github/release.json` archive profile.
No archive is extracted or executed by retention.

`storydeck.source-candidate.v1` records source and tested head/tree (trees must equal),
original manifest/lock hashes, inspector/profile identity, Node version and the original
archive filename, name, version, SHA256/SHA1/SRI, byte count and complete member census.
`memberBindings` identifies source-owned members versus tested `dist/` output. Source
members equal immutable Git bytes; build members equal the regular files just checked.
The artifact holds exactly the original `.tgz`, `source-package.json`,
`source-package-lock.json` and `candidate.json`. Provider run/job/artifact/outer-ZIP identity
must be joined separately; this receipt is not registry provenance or a source verdict.

Focused tests use the same pinned inspector, supplied with `STORYDECK_INSPECTOR_ROOT`
pointing to its `src/release-route/archive` directory. They create only inert byte fixtures.
