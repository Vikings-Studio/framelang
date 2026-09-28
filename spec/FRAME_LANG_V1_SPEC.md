# FrameLang v1: a constrained scene language for HyperFrames

Status: Proposed RFC
Created: 2026-09-26
Owner: MakeMyDemo video pipeline
Scope: Generated launch videos and teasers in the V2 HyperFrames path

`MUST`, `MUST NOT`, and `MAY` below are normative. Values called proposed
defaults are part of this v1 proposal and should be changed only by revising
the versioned profile registry before implementation, not by an individual
generation request.

## 1. Decision and promise

FrameLang is a versioned, typed scene description. An AI may select content,
evidence, composition, and motion intent. It may not emit HTML, CSS, JavaScript,
GSAP, arbitrary CSS coordinates, `z-index`, or clipping rules. It may supply
bounded positions in a profile-safe canvas and typed keyframes. A deterministic compiler
turns FrameLang into the existing HyperFrames artifact and records how every
visible element was derived.

The enforceable promise is:

> For a valid FrameLang document whose required assets and fonts are available,
> compilation either produces an artifact that passes the declared structural,
> geometry, timing, and existing render-admission checks for every requested
> output profile, or returns a typed failure. No known-red artifact is admitted.

This is deliberately narrower than “any prompt always yields a good video.”
Source material may be insufficient, a request may be impossible within its
time budget, and external rendering or storage can fail. Recoverable design
conflicts use deterministic alternatives; unrecoverable conflicts are reported
without silently omitting essential content or lowering the quality gate.

FrameLang is distinct from the existing `frame.md` brand specification built by
`backend/src/lib/frameSpec.js`. That file remains an input of brand tokens and
style policy. FrameLang is the scene program.

## 2. Why this boundary is needed

V2 currently requests `html`, `css`, `portraitCss`, and `timeline` strings per
scene in `backend/src/lib/hyperframesV2.js`. Code assembles the fragments and
then lint, browser, composition, and render-side checks determine whether they
are acceptable. This leaves the model in control of layout and animation
mechanisms that the system subsequently tries to police. The code already
enforces important invariants, including scene timing injection, persistent
overflow blocking, and admission parity. FrameLang moves preventable failure
classes out of the model's output space while retaining those checks as proof.

Specific failures the language must make unrepresentable include:

- Semantic text clipped by a fixed card, canvas, or `overflow:hidden` ancestor.
- Two essential objects unintentionally occupying the same space, including
  after portrait reflow or during an animation's maximum excursion.
- Stacking-context surprises, unanchored cursors/badges, and one scene covering
  another because its timing attributes were omitted.
- Missing IDs, invalid timeline statements, conflicting transform writers,
  unrevealed content, unresolved UI states, and content disappearing before the
  end of its scene.
- Unstaged media paths, remote runtime dependencies, unpinned fonts, and
  nondeterministic state driven by clocks, random values, or browser events.

The language also needs to preserve creative range: it must express strong
typography, product demonstrations, comparisons, and controlled transitions
without forcing every scene into the same centered card.

## 3. Scope

### Included in v1

- Text, image, timed video clip, shape, captured-product-state, SVG asset, and group nodes.
- Stack, split, grid, anchored-overlay, and constrained-canvas layouts.
- Typed solid/gradient paint, text styles, and bounded property keyframes.
- Landscape and portrait profiles when requested by the job. A profile is
  admitted only after its own layout and checks pass.
- Integer-frame scene timing, state changes, and a bounded set of seekable
  motion effects.
- Declared brand tokens and staged asset references.
- Deterministic fitting, reflow, and limited recovery.
- Compiler diagnostics, source maps, artifact fingerprints, and a conformance
  corpus.

### Excluded from v1

- General HTML/CSS/JS authoring, model-authored inline SVG paths, shaders, WebGL, custom
  animation functions, arbitrary easing curves, and runtime network requests.
- Audio synthesis, narration scripting, captions, music selection, and mixing.
  Existing pipeline stages own these. FrameLang consumes optional locked
  narration/beat anchors and checks scene duration against their timing.
- Factuality and aesthetic quality guarantees. Evidence validation and visual
  review remain separate checks.
- Importing arbitrary existing HyperFrames projects. FrameLang compiles to
  HyperFrames; it is not a complete inverse representation of HyperFrames.

## 4. Language form and versioning

The canonical wire and checkpoint form is JSON. A future human-facing YAML
syntax may parse into the same canonical tree, but JSON is the only v1 exchange
format between the model, compiler, and durable checkpoint. Unknown fields are
errors. No implicit unit conversion is allowed.

Top-level shape:

| Field | Type | Meaning |
| --- | --- | --- |
| `language` | literal `framelang/v1` | Selects the exact grammar and semantics. |
| `fps` | integer, initially `24` | One time base for the whole program. |
| `profiles` | nonempty array of profile IDs | Output sizes to prove independently. |
| `brandRef` | `sha256:` plus 64 lowercase hex characters | Identifies the resolved brand-token snapshot. |
| `assetsRef` | `sha256:` plus 64 lowercase hex characters | Identifies the staged asset manifest. |
| `seed` | unsigned integer | Seed for compiler-owned decorative variation only. |
| `scenes` | nonempty ordered array | Defines the video sequence. |

V1 profile IDs are `landscape-1920x1080` and `portrait-1080x1920`. Profiles
specify frame size, safe-area insets, typography floors, and permitted layout
variants in a versioned compiler-owned registry. A scene may provide an explicit
layout variant for each requested profile; otherwise its layout must be
provably feasible under the profile's deterministic default reflow. The
compiler may not satisfy portrait by scaling or cropping landscape.

Proposed v1 profile policy:

| Profile | Safe inset (left/right, top/bottom) | Headline/body minimum | Opening deadline |
| --- | --- | --- | --- |
| Landscape | 120 px, 96 px | 64 px / 36 px | Frame 10 |
| Portrait | 72 px, 96 px | 64 px / 40 px | Frame 10 |

These are minimums, not prescribed design sizes. Captions, when enabled by
the surrounding pipeline, reserve an additional versioned bottom region;
layouts MUST be solved against the reduced content area. All semantic text
MUST meet a measured contrast ratio of at least 4.5:1 against its actual
background at every visible frame. A token that fails may be replaced only
with a compiler-approved, brand-related accessible variant whose choice is
recorded in the compile report.

All durations, event positions, and effect lengths are integer frames. Scene
IDs and node IDs are unique within their scopes and stable across profiles.
Canonicalization sorts object keys, normalizes Unicode to NFC, preserves array
order, and hashes the resulting UTF-8 bytes. Numeric strings, seconds, and
floating-point frame positions are rejected.

## 5. Scene model

Each scene has the following fields:

| Field | Required | Contract |
| --- | --- | --- |
| `id` | Yes | Stable scene ID; referenced in diagnostics and checkpoints. |
| `role` | Yes | Existing story role such as `hook`, `feature_showcase`, or `cta`. |
| `blueprint` | Yes | A supported FrameLang blueprint ID and version. |
| `durationFrames` | Yes | Positive integer within the active product profile's range. |
| `essential` | Yes | Node IDs whose content or meaning cannot be dropped. |
| `content` | Yes | Flat registry of typed nodes; layout trees reference their IDs. No markup strings. |
| `layouts` | Yes | A `default` tree or a tree for every requested profile. |
| `states` | Yes | Named visibility/content states, including a resolved final state. |
| `initialState` | Yes | State active at frame 0. |
| `resolvedState` | Yes | State that must hold through the scene's final 15%. |
| `events` | Yes | Ordered frame-local state changes and motion effects. |

Scene order determines global start frames by prefix sum. The compiler owns
HyperFrames clip tags, IDs, tracks, root duration, and seam handling. A scene
cannot set these. Its last frame belongs to that scene alone; the next scene
starts on the next frame. Transitions between scenes are compiler-owned effects
with an explicit overlap policy, never accidental simultaneous visibility.

### Node union

Every node has `id`, `kind`, and `importance` (`essential`, `supporting`, or
`decorative`). Essential status must agree with the scene's `essential` list.
The supported kinds are:

| Kind | Required data | Compiler behavior |
| --- | --- | --- |
| `text` | Literal copy, text role, language, fit policy | Measures glyphs with the pinned font and preserves full copy. |
| `image` | Staged asset ID, fit mode, focal metadata | Preserves image aspect ratio; reports missing or unsuitable assets. |
| `videoClip` | Staged asset ID, source start and length in frames, rational playback rate, fit mode | Seeks a finite source range; existing audio stages own sound. |
| `productState` | Captured component/state ID or verified staged state asset | Shows a specific evidenced product state. |
| `shape` | Approved primitive and tokenized style | Renders a line, panel, circle, or simple connector. |
| `svg` | Hashed local SVG asset ID, display permission, license, and fit | Renders a verified vector asset without runtime network access. |
| `group` | Ordered children | Gives content a shared layout and animation identity. |

Text is data, escaped by the compiler. It cannot contain HTML, CSS, `<br>`,
remote font URLs, or hidden control characters. Intentional display line breaks
are an explicit `lines` array, allowed only for short titles; ordinary body
text wraps according to measured width. No generated URL is displayed unless
it comes from the verified brand or evidence manifest.

`content` is a flat array. Each node ID appears exactly once there. Every
content node is reachable from at least one layout, directly or through its
owning group, unless it is a compiler-generated decoration. Layout references
cannot introduce content. A group references child IDs; cycles and duplicate
ownership are errors.

`productState` may not invent an interaction, customer, quote, or result. Its
reference must resolve to captured evidence. A source screenshot can be used
as a visual reference only unless the asset manifest explicitly marks it as
licensed, displayable content; this keeps the current capture boundary.
An essential image or clip uses `contain`; `cover` is limited to decorative
material or a manifest-declared nonsemantic crop region. Each evidence entry
includes asset ID, media kind, byte hash, dimensions, display permission,
captured component/state identity where applicable, and claim relationships.
The manifest establishes provenance; whether a depicted claim is true and
persuasive still needs content review.

## 6. Layout semantics

Layout is a tree. A node appears once in each active layout variant unless it
is decorative and explicitly omitted for that profile. Essential and
supporting nodes may change order or placement across profiles but may not be
omitted. Stack, split, grid, and overlay layouts have no free coordinates.
The constrained canvas accepts an integer rectangle in thousandths of each
profile's inset safe area; bounds, intended overlap, layer, text fit, and
motion excursion are validated. It is positioning as typed data, not CSS.

`layouts.default` applies to every requested profile for which no explicit
profile key exists. A profile-specific tree takes precedence. If neither
exists, semantic validation fails. The permitted split ratios are `40:60`,
`50:50`, and `60:40`; the permitted gap tokens are `tight`, `regular`, and
`comfortable`, resolved by the profile registry. An omitted gap is `regular`.
Grid tracks are equal width
in v1, with one to three columns and at most six cells. Attachments in an
overlay name an existing anchor and one placement from `sameBounds`, `above`,
`below`, `leading`, `trailing`, or `insideCorner`. The solver may choose an
alternate side only if the blueprint explicitly declares that choice.

| Layout | Structure | Rules |
| --- | --- | --- |
| `stack` | Ordered children | Flow in row or column with tokenized gap, alignment, and bounded padding. |
| `split` | Exactly two regions | Ratio from a finite registry; reflows to a stack when declared or when the profile requires it. |
| `grid` | 1–3 columns, bounded cell count | Content-aware track sizing; deterministic row order. |
| `overlay` | One base and named attachments | Each attachment anchors to an existing node or region, with a declared side and clearance. |
| `canvas` | Per-profile bounded placements | Explicit safe-area rectangles and intentional overlap declarations; compiler owns emitted coordinates and stacking. |

The compiler uses the following hierarchy of constraints:

1. **Hard:** Every essential glyph and asset region stays inside its safe area;
   no essential content is clipped or unintentionally occluded; minimum
   readable text size and contrast hold; declared layer order and motion bounds
   hold; all content resolves by scene end.
2. **Hard:** Every supporting node remains present and readable unless the
   scene explicitly marks an alternative representation with the same text or
   evidence reference.
3. **Soft, ordered:** Preferred ratio, alignment, negative space, display-size
   target, gap, and decoration. The compiler may adjust these in this order to
   satisfy hard constraints, and records each adjustment.

Layout solving is deterministic: same normalized inputs and toolchain produce
the same chosen variant and dimensions. A layout has measured minimum and
preferred sizes. Parents allocate space based on children's measured sizes,
not a guessed number of characters. Text measurement happens only after
required font bytes load successfully; a silent fallback font is an error.
Long unbreakable strings use an explicit break policy, not implicit clipping.

### Text fit policy

`fit` is one of `fixed`, `wrap`, or `wrapThenShrink`. The text role supplies a
preferred size, line height, maximum lines where appropriate, and a minimum
readable size per profile. `wrapThenShrink` tests a finite descending size
ladder with measured line boxes. It chooses the largest size that fits all
constraints. It never reduces below the role's minimum. `fixed` and `wrap`
fail if their constraints cannot be met. Ellipsis, cropping, and text deletion
are not fit strategies for semantic text in v1.

### Safe-area and overlap policy

Safe-area insets are profile properties, not model-authored pixel values.
Adjacent essential or supporting items have a profile-specific minimum gap.
An overlay may intentionally overlap its declared anchor but may not cover
semantic text or another essential target. Decorative nodes are drawn behind
semantic content unless a blueprint explicitly permits a foreground effect
whose swept bounds remain clear of semantic regions.

`sameBounds` is an **exclusive-state slot**: two essential states may occupy
identical geometry only when exactly one is resolved at a time. During a
declared replacement interval, both may be partly visible in that slot. The
overlap audit treats only this bounded crossfade as intentional, checks each
endpoint for legibility, and requires the old state to be fully retired
afterward. It does not permit arbitrary essential overlap.

The compiler assigns semantic layers: `background`, `surface`, `content`,
`annotation`, `transition`, and `captions-reserved`. It emits isolated stacking
contexts and fixed ordering. The model cannot set `z-index`, opacity on a
semantic parent, or CSS properties that introduce a new stacking context.
Every overlay remains in its anchor's coordinate system across profiles.

## 7. Motion and state semantics

A scene is a finite-state timeline evaluated as a pure function of integer
frame `f`, where `0 <= f < durationFrames`. Every visible state at `f` must be
reconstructible without replaying earlier frames. The compiler may generate a
paused GSAP timeline for HyperFrames, but the language exposes state changes,
not GSAP statements.

Each state is a complete set of visible node IDs. Nodes absent from the active
state are hidden; layout space for mutually exclusive states is reserved as
the union of their measured bounds. `initialState` and `resolvedState` MUST
reference defined states. The resolved state MUST be reached no later than
`floor(0.85 * durationFrames)` and remain unchanged thereafter. An essential
node may be temporarily hidden when its declared state has not yet appeared;
it must be visible in at least one intended semantic state and cannot vanish
from the program or final payoff without an explicit replacement relationship.

V1 effects are `appear`, `disappear`, `moveWithinSlot`, `scaleWithinSlot`,
`emphasize`, `revealMask`, `replace`, and `cameraWithinSurface`. Each effect has
an enumerated easing and bounded duration. Effects may animate opacity,
transform, color, or mask values only where the blueprint permits them. They
may not change layout dimensions during playback. The compiler calculates a
conservative swept rectangle for every effect and reserves that space before
layout is accepted. Overshooting easing is allowed only if its maximum excursion
is included in that rectangle.

Typed transform/opacity `tween` events are a direct keyframe form for broad
motion authoring. They use finite numeric endpoints and enumerated easing.
The v0.1 pilot rejects conflicting node writers and checks endpoint ranges;
the swept-geometry proof described above is a v1 requirement still to build.
More elaborate path, mask, and shader effects belong to versioned
deterministic extensions with declared bounds, rather than injected GSAP.

Events have `atFrame`, `durationFrames`, `effect`, and node/state references.
Two events may not write the same property of the same node on overlapping
frames. References to absent nodes or states fail semantic validation. A
`replace` event requires old and new states and guarantees that the old state
is retired no later than the new state becomes resolved. Scene output must
provide meaningful visible content by the active profile's opening deadline
and keep the resolved state through the final 15% of scene frames, matching the
intent of the current V2 gates.

Events are sorted by `atFrame`, then by their array order. They MUST start at
or after frame 0 and finish before `durationFrames`. Zero-length events are
allowed only for instantaneous state changes. The `replace` interval displays
the old state at its start and the new state at its end; intermediate opacity
is a compiler-owned crossfade inside the union of both states' reserved
bounds. A state transition with no declared event is an error.

The compiler, rather than the model, owns scene root visibility, transition
seams, and final holds. Runtime clocks, unseeded randomness, infinite loops,
hover, scroll, event listeners, and render-time network requests are outside
the language.

V1 uses hard cuts between scenes. No cross-scene overlap is permitted;
intra-scene replacements and fades supply motion. A future cross-scene
transition must define ownership of its frames and how it changes total
duration before it enters the language.

An optional locked `syncManifest` maps word, beat, and emphasis IDs to global
frames. An event may refer to one anchor plus an integer offset; the compiler
resolves it before timeline validation. Missing anchors, events outside the
declared sync window, or a product result appearing before its required
narration cue are semantic failures. Final video and audio are checked
against the same frozen timing manifest.

## 8. Example program

This is a structurally conforming example. The two hashes and capture-state
references stand in for entries supplied by a real frozen input bundle. The
JSON Schema implementation must encode the field and range contracts in this
RFC; it may not loosen them.

```json
{
  "language": "framelang/v1",
  "fps": 24,
  "profiles": ["landscape-1920x1080", "portrait-1080x1920"],
  "brandRef": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "assetsRef": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  "seed": 47,
  "scenes": [{
    "id": "s1",
    "role": "feature_showcase",
    "blueprint": "product-reveal/v1",
    "durationFrames": 144,
    "essential": ["headline", "before", "after"],
    "content": [
      {"id": "headline", "kind": "text", "importance": "essential", "role": "headline", "language": "en", "text": "Turn a page into a demo", "fit": "wrapThenShrink"},
      {"id": "before", "kind": "productState", "importance": "essential", "stateRef": "capture:editor-empty"},
      {"id": "after", "kind": "productState", "importance": "essential", "stateRef": "capture:editor-result"}
    ],
    "layouts": {
      "landscape-1920x1080": {"type": "split", "ratio": "40:60", "left": "headline", "right": {"type": "overlay", "base": "before", "attachments": [{"node": "after", "anchor": "before", "placement": "sameBounds"}]}},
      "portrait-1080x1920": {"type": "stack", "direction": "column", "children": ["headline", {"type": "overlay", "base": "before", "attachments": [{"node": "after", "anchor": "before", "placement": "sameBounds"}]}]}
    },
    "initialState": "initial",
    "resolvedState": "resolved",
    "states": [
      {"id": "initial", "visible": ["headline", "before"]},
      {"id": "resolved", "visible": ["headline", "after"]}
    ],
    "events": [
      {"atFrame": 48, "durationFrames": 12, "effect": "replace", "from": "initial", "to": "resolved"}
    ]
  }]
}
```

The `sameBounds` replacement is deliberate: the two product states occupy one
reserved slot and never compete for layout space. Whether the referenced
states actually exist is determined from the captured evidence manifest.

## 9. Compiler pipeline

Compilation is a pure, versioned operation over a frozen input bundle. The
bundle contains the canonical FrameLang JSON, resolved brand tokens, asset
manifest and bytes, font bytes, blueprint registry version, compiler version,
HyperFrames version, browser build, and validation-profile version.

```text
model JSON
  → parse and schema check
  → evidence and semantic check
  → profile-specific text measurement and layout solve
  → motion-bound and state analysis
  → finite deterministic candidate search, if needed
  → HyperFrames HTML/CSS/paused timeline generation
  → per-frame semantic geometry audit
  → existing HyperFrames and render-admission checks
  → immutable artifact + provenance
```

### Parse and semantic check

JSON Schema validates shapes, required fields, ranges, and discriminated node
kinds. A separate semantic pass validates cross-references, unique IDs,
evidence ownership, state reachability, timeline ordering, role/blueprint
compatibility, and profile completeness. Schema validity alone is not an
acceptance signal.

### Measurement and solve

For each requested profile, load the exact font and image bytes in the pinned
browser environment. Measure all text at permitted sizes, image intrinsic
dimensions, and layout child minima. Solve the declared layout tree with a
fixed rule order and deterministic tie-breakers. Record the chosen size,
wraps, layout variant, bounding rectangles, and swept motion rectangles.
Browser-rendered measurements are compared to the solver's predictions; a
material mismatch fails compilation rather than being hidden by clipping.

### Geometry audit

The semantic audit evaluates every output frame in each requested profile, or
uses a proven envelope for an effect whose extrema and monotonicity are known
by the compiler. It checks safe areas, DOM glyph boxes and clipping ancestors,
asset visibility, declared layer ownership, state visibility, and the reserved
caption region. It samples rendered pixels for actual-background contrast and
occlusion where geometry alone is insufficient. When a proof shortcut cannot
establish safety, it samples every frame. A text fade is exempt from the 4.5:1
contrast test only until the glyph reaches its declared readable opacity;
essential text must reach that opacity by its semantic reveal deadline and
hold it through its required state. Thresholds and tolerances belong to the
versioned audit policy. The existing HyperFrames check and production quality
gate remain independent
admission requirements. A missing or suppressed layout audit is a failure.

### Output and provenance

The compiler emits the current V2 artifact shape, including `index.html`,
duration, scene metadata, referenced assets, requested profile variants,
`checkOk`, and the validation-profile version. It also emits a source map from
generated DOM selectors and timeline effects to FrameLang scene/node/event
paths, a compile report, and a content hash over the frozen input bundle.
Renderer admission recomputes the hash and checks that the exact artifact and
profile set were validated; it does not recompile from mutable inputs.

## 10. Recovery and failure behavior

Recovery is a bounded compiler procedure, never an untracked model rewrite.
The compiler enumerates finite combinations of the choices below, prunes
candidates that fail hard constraints, then selects a survivor by this
lexicographic ranking: no degradation, preferred profile layout, largest
essential text, largest supporting text, greatest spacing, fewest decorative
changes, and stable candidate ID. Every attempted choice is recorded.

1. Reduce soft gaps and padding within the blueprint's bounds.
2. Select the largest permitted text size that fits; wrap according to the
   text role's rules.
3. Choose a blueprint-declared profile layout variant, such as split to stack.
4. Remove or simplify decorative nodes only.
5. Select a blueprint-declared `safe` presentation that preserves all essential
   text, evidence, and state meaning.

The compiler does **not** automatically extend a scene, change its narration
alignment, split a scene, replace product evidence, shorten essential copy, or
lower readability thresholds. Those change the story or timing contract and
require a new plan or a targeted model edit before compilation is retried.

A safe presentation is a validated content-first frame with a measured text
region and a contained evidence region. It may reduce flourish, but it must
retain every essential node, the final resolved state, and the source-to-output
mapping. It is labeled `degraded: true` in the compile report and is counted
separately from preferred-layout acceptance. Product policy may cap degraded
scenes per video; exceeding the cap is a failure, not a silent success.

Failure codes are stable and machine-readable:

| Code family | Example | Action |
| --- | --- | --- |
| `syntax` | Unknown node kind or field | Ask the model for a schema-correct patch. |
| `reference` | Missing node, state, asset, or font | Patch the reference or obtain evidence. |
| `semantic` | Conflicting state writes or unsupported blueprint | Patch the scene intent. |
| `fit` | Essential headline cannot meet minimum size | Revise copy, layout, duration, or scene plan. |
| `geometry` | Unintended overlap at frame 73 | Patch the affected layout or motion event. |
| `admission` | HyperFrames check or production gate rejects output | Keep artifact out of render queue; attach provenance. |
| `infrastructure` | Font load, browser, render, or storage unavailable | Retry under existing durable-job policy. |

Every finding includes profile, scene ID, node IDs, frame or frame interval,
measured and allowed values, violated rule, and the shortest editable
FrameLang path. A syntax/semantic patch never edits compiled HTML. Accepted
scenes and their compile reports remain checkpointed and reusable.

## 11. Determinism and security contract

The same frozen input bundle must yield byte-identical generated source and
frame-identical rendered output in a pinned browser/font environment.
Cross-OS native runs must agree on canonical source hashes, diagnostics,
acceptance, duration, and semantic geometry within declared tolerances;
uncontainerized macOS, Linux, and Windows pixels need not be byte-identical.
The parser rejects duplicate object keys, unsafe integers, non-finite numbers,
and invalid Unicode before canonicalization. `seed` is an unsigned 32-bit
integer, and all numeric fields are safe JSON integers. Determinism tests
must seek frames in shuffled order and compare them with sequential renders.
Changing compiler, blueprint, font, asset, browser, HyperFrames, or validation
versions invalidates the prior proof and requires recompilation and admission.

All asset references resolve through a staged manifest; runtime URLs are
forbidden. Text is escaped, image formats are validated, and output is subject
to the existing restrictive render environment. The model's JSON is treated
as untrusted data. It cannot inject selectors, scripts, attributes, file
paths, or shell commands. Compiler-generated IDs are namespaced and all
rendered files are written under the artifact root.

## 12. Agent contract

The planner continues to choose narrative roles, evidence-backed beats,
blueprints, and frame budgets. A FrameLang scene author returns only the scene
object and references only the evidence assigned to that scene. The prompt
shows the allowed schema, one selected blueprint card, available tokens and
assets, and relevant diagnostics. It does not teach HTML or GSAP rules.

The model is permitted to revise copy, choose a declared layout variant,
select among approved effects, and adjust state timing. It is not permitted
to invent assets, facts, UI states, customers, or URLs. Repair receives the
failed FrameLang paths and returns a typed patch. The harness applies and
rechecks the patch; it never treats a model's self-assessment as validation.

## 13. Integration and rollout

No existing render artifact or checkpoint is silently reinterpreted. The
current V2 fragment route stays intact during shadow evaluation. A feature
gate selects the authoring path; both paths feed the same artifact admission
boundary. A FrameLang checkpoint records `language`, compiler, blueprint,
input, and validation versions so resume cannot mix incompatible scenes.

| Stage | Deliverable | Exit condition |
| --- | --- | --- |
| 0. Baseline | Frozen V2 fixtures and failure corpus: overflow, occlusion, seam, empty opening, portrait collision, font fallback, and repair cost. | Baseline outcomes and runtime measured. |
| 1. Language core | JSON schema, semantic validator, canonicalizer, typed diagnostics, and three blueprints: type reveal, product reveal, before/after. | Invalid programs fail at the intended layer; valid programs round-trip canonically. |
| 2. Compiler | Font/asset measurement, profile layout solver, motion-state compiler, source map, and HyperFrames emitter. | Golden scenes compile and seek deterministically. |
| 3. Proof and recovery | Framewise semantic geometry audit, bounded recovery, safe presentations, and existing admission gate integration. | Negative corpus cannot be admitted; positive corpus passes both paths. |
| 4. Shadow evaluation | Generate FrameLang beside the current author for frozen launch and teaser inputs. | Compare intent-to-treat first-pass acceptance, degradation, cost, render time, and blind visual review. |
| 5. Controlled switch | Route supported blueprints through FrameLang by flag; preserve current V2 for unsupported cases during migration. | Real jobs retain admission parity and show no new failure class. |

Likely implementation boundaries are `backend/src/lib/hyperframesV2.js` for
planning/authoring orchestration, new `backend/src/lib/frameLang/` modules for
the schema/compiler, `backend/src/lib/hyperframesPreflight.js` for generation
proof integration, and `render-backend/src/lib/hyperframesRenderer.js` for
admission provenance. Existing tests in `backend/test/hyperframesV2Routing.test.js`,
`backend/test/hyperframesV2MotionQuality.test.js`, and
`backend/test/urlVideoPipeline.test.js` provide the regression baseline; add
focused compiler and conformance tests under `backend/test/`.

## 14. Verification contract

The implementation is not ready for rollout until these scenarios pass:

1. **Overflow:** Long English, long unbreakable URLs, CJK, mixed-script copy,
   and maximum permitted card content either fit above the role minimum or
   return `fit` findings. No essential glyph is clipped in either profile.
2. **Stacking:** Annotations, cursors, masks, captions, and transitions have
   declared ownership; no incidental stacking context can cover text or leak
   one scene into another.
3. **Motion extremes:** Every emitted frame, including easing overshoots and
   transition boundaries, satisfies swept-bound and safe-area rules.
4. **State:** A replacement retires the old UI, resolves the new UI, and holds
   the final result. Missing or unreachable states fail before rendering.
5. **Determinism:** Repeated compile/render, shuffled-frame seeking, and
   checkpoint resume produce identical hashes and frames under pinned inputs.
6. **Evidence:** Missing assets, changed asset bytes, missing font bytes,
   invented product states, and unauthorized displayable screenshots fail
   clearly and cannot be replaced by plausible-looking filler.
7. **Parity:** The exact admitted artifact passes generation and production
   gates with the same blocking policy and profile set. A failed or skipped
   audit never yields `checkOk: true`.
8. **Recovery:** Every deterministic adjustment is reported. The safe
   presentation retains all essential content; impossible content fails and
   is not queued for rendering.
9. **Compatibility:** Current V2 jobs and checkpoints continue through their
   existing route until explicitly migrated; no old artifact is relabeled as
   FrameLang output.

Success is measured separately for structural reliability and creative
quality. Structural targets are zero admitted overflow, occlusion, seam, or
unresolved-state findings in the conformance corpus and initial production
sample. Track preferred-layout acceptance, safe-presentation frequency,
model calls, latency, and cost against the frozen V2 baseline. Blind visual
review must show that the constrained language did not turn every video into
the same template. The initial sample size and rollout threshold should be
set from baseline data before the feature gate is widened.

### One-shot evaluation protocol

Freeze briefs, evidence, fonts, assets, duration, required profiles, model
version, prompt/token budget, timeout, and OpenCode tool access before either
arm runs. A one-shot attempt is one model response with no model repair or
human edit before scoring. Compiler-owned fitting and safe-presentation
selection are allowed, but counted and disclosed. Use all assigned attempts
as the primary denominator: preferred admitted, degraded admitted, typed
content failure, structural-gate failure, and infrastructure failure are
separate outcomes. The primary success metric is an admitted,
non-degraded, evidence-faithful video in every requested profile.

Pilot on twelve frozen briefs across the three first blueprints, with three
independent OpenCode attempts per arm, then lock thresholds and use a held-out
confirmation set of at least thirty briefs. The control arm authors raw
HyperFrames under the same one-response budget and passes the same final gate.
Three reviewers, blinded to arm and given the original brief/evidence, score
brief coverage, factual fidelity, legibility, motion clarity, visual
distinctiveness, and overall preference. Report disagreements and results by
blueprint, profile, and failure type. Publish prompts, transcripts, artifacts,
compiler reports, gate findings, and score sheets without credentials or
private customer material. A separate adversarial corpus tests expected
pass/fail behavior for text, fonts, assets, masks, seams, portrait, and state
timing.

## 15. Decisions to lock before implementation

1. **Canonical syntax:** JSON is proposed for model exchange and checkpoints;
   YAML remains optional human authoring sugar.
2. **V1 breadth:** Ship three blueprints first, then add language capabilities
   only when a real creative use case cannot be expressed.
3. **Degradation policy:** Decide the maximum safe-presentation count per
   video, and whether any such scene requires user review before delivery.
4. **Profile policy:** A job declares its required profiles up front. Both
   must pass only when both were requested; no silent profile omission.
5. **Time budget:** Measure the cost of framewise audits on the saved V2
   fixtures and establish a latency ceiling without weakening proof.
