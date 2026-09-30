# Source-preserving HyperFrames admission (experimental)

FrameLang has two authoring paths. Typed JSON offers constrained animation and
layout semantics. Trusted HyperFrames HTML preserves the model's HTML, CSS, SVG
and GSAP design exactly, without a second model call to translate it into JSON.

```sh
node src/cli.mjs adopt path/to/composition path/to/new-output
node src/cli.mjs check path/to/new-output
node src/cli.mjs render path/to/new-output
```

The source directory contains `index.html` and `assets/`. Output must be a new
directory outside the source. The root composition explicitly declares
`data-composition-id`, `data-width`, `data-height`, `data-fps` and
`data-duration`. Duration must contain a whole number of frames (1–18000).

`adopt` copies source bytes and assets, records their hashes, maps element IDs
to source lines, and marks output unchecked. It validates ordinary declared
resource references in HTML, CSS and SVG; stylesheet imports and symlinks are
unsupported. `check` requests every output frame for geometry, checks runtime
findings and runs HyperFrames' sampled contrast/lint audits. `feedback.json`
contains selectors, source locations, bounding boxes and time ranges for repair.
`render` requires a passing check, unchanged source/assets and asset and composition input inventories,
and the recorded checker/runtime fingerprint. Render output is stored outside
the sealed composition in `renders/<profile>/video.mp4`. There is no visual fallback or
silent layout rewrite. A rejected source needs a model or author repair.

## Scope of the guarantee

This is **trusted-source validation**, not an untrusted-code sandbox or a
proof that arbitrary JavaScript is deterministic. Resource scanning is a
packaging check, not a security filter: dynamic JavaScript, escaped CSS resources,
clock dependence and mutation can evade declarative checks. Run only trusted
compositions. Do not expose this command directly to public uploads. A future
untrusted tier requires an AST allowlist and network-denied isolated renderer.
The fingerprint covers Node, lockfile, entire installed HyperFrames package and check code;
it does not pin the OS, browser executable or installed transitive dependency
contents (the lockfile records their expected versions). A passing frame audit is measured
evidence, not a universal guarantee against all visual or semantic defects.

The CLI records no model cost because it makes no model calls. A video's
inference cost still includes its original generation plus every repair call.
Adopting an existing accepted video adds zero inference, while checks/rendering
still consume compute. Never relabel a reused raw artifact as a new independent
FrameLang generation, or claim a cost/quality win from identical reused source.
