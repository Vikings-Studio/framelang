# FrameLang v0.1 creative authoring

The original five-model experiment restricted FrameLang to four copy fields,
exactly two text nodes, a centered stack and fixed reveal timing. Raw HTML could
choose hierarchy, emphasis, supporting content, background atmosphere and motion.
Its stronger visuals expose a constrained prompt, not a controlled test of the
current renderer's expressive ceiling.

`framelang/creative-v0.1` makes those choices available to models directly. It
expands into the existing `framelang/v1` state/timeline IR, with no model-authored
HTML, CSS, JavaScript, hashes or state lists. It is a design surface, not a
copy-only recipe. A frozen `bundle.json` beside the authored file supplies brand
and verified assets.

## Document

```json
{
  "language": "framelang/creative-v0.1",
  "scenes": [{
    "id": "hook",
    "durationFrames": 96,
    "design": {"decoration": "grid-glow", "ambient": "drift"},
    "nodes": [{
      "id": "headline",
      "segments": [
        {"text": "Paste a public URL.", "breakAfter": true},
        {"text": "Get a first cut.", "tone": "accent"}
      ],
      "rect": [0, 120, 1000, 550],
      "portrait": [0, 120, 1000, 550],
      "style": {"size": 170, "minSize": 64, "maxLines": 4},
      "motion": {"preset": "rise", "atFrame": 0, "durationFrames": 24}
    }]
  }]
}
```

Optional document fields: `fps` (24), `seed` (47), `profiles` (landscape and
portrait by default). Scene duration remains 48–288 frames. Scene fields are
`id`, `durationFrames`, `design`, `nodes`; unknown fields fail.

## Model-owned choices

- Full typed scene design: alignment, display scale, layered/alpha gradients,
  grid glow, rules, ambient drift, optional editorial chrome. Compact paint
  layers are authored bottom-to-top (base first); expansion reverses them for
  CSS. Full IR paint layers keep their existing top-to-bottom convention.
  This prevents an opaque base from hiding the model-selected gradient.
- Text: copy or up to eight emphasis/line-break segments; left/center/right
  alignment; weight; case; tracking; line height; italic; verticalAlign start/center/end; brand/hex color.
  Size accepts existing named tokens or integer pixels 24–240. `maxLines` is
  optional, 1–8; it participates in measured fitting.
- Nodes: text, flow, inputCard, videoArtifact, shape, verified local SVG and
  productState, using the existing typed content fields.
- Geometry: `rect` or `relative` in thousandths of the safe canvas. `portrait`
  can override placement using an object or a four-integer rectangle. Omitted
  portrait inherits the landscape geometry, not a guessed reflow.
- Motion: `none`, an existing entrance preset, or an object with preset,
  atFrame and durationFrames. `frames` plus ease selects existing bounded
  transform/opacity keyframes. One node has one motion owner. No wall-clock
  timers, arbitrary expressions or external script loading.

## Defaults and guardrails

Text defaults to headline, English, wrapThenShrink, left alignment and hero
scale. Headlines have a 64px minimum, body32px and labels24px in the compact
surface; a model may increase those floors. The compiler checks requested size
against its minimum for **each** profile. Measured fitting fails if copy cannot
fit above that floor or within maxLines; it does not make headlines tiny merely
to pass a bounds check. Long text must be shortened or its rectangle enlarged.

Shapes default decorative, static and layer0; functional content defaults
layer1. A panel that fully contains later/higher content is a background
underlay, so its decorative overlap is marked explicitly in the expanded IR.
Partial intersections and functional-on-functional overlaps still fail lint.
Explicit `overlap:"avoid"` prevents underlay inference. Raised opaque panels
cannot use this rule to hide text. Labels sharing the exact panel rectangle
default to vertical centering; an explicit verticalAlign keeps model intent. Directly positioned shapes have no inherited
120px minimum height; their authored rectangles own their size.

Narrow landscape chains (under900px) reflow vertically. Horizontal chains share
space across the steps and outcome, so long outcomes cannot squeeze the steps.
Vertical process chains reserve at least 100px per step plus100px for arrow and
outcome, before rendering. This is a minimum component-space contract; browser
checks still measure the actual layout and text. Component scroll dimensions
are also checked against their owned rectangles, so content cannot quietly
spill into neighboring labels or chrome. Models can use fewer steps or
allocate a larger portrait rectangle.

Input cards reserve at least280px landscape /450px portrait. Video artifacts
reserve450px /700px, or260px /360px with `density:"compact"`. Browser checks still
measure the actual content and motion; small decorative rectangles cannot be
used as undersized rich components.

Default entrances are staggered by node index, beginning within ten frames.
The existing opening and final-hold rules, semantic coverage checks, safe-canvas
bounds, lint overlap diagnostics and local hashed asset verification apply.
Expansion always enables allFrames verification. Rendering remains gated on
all profile checks; any sampled geometry collision blocks it, including brief
findings the underlying checker demotes to informational severity.

Video artifacts default to preview phase; models may choose export explicitly.
Essential content cannot end a keyframe or tween with opacity below0.95 or scale
below0.1. Contrast feedback includes measured findings and source locations.

Static nodes/scenes are valid language input. Static imagery is a visual choice,
not proof of motion quality; runtime motion checks can still reject a frozen
composition. A passing geometric check is not a factual or aesthetic verdict.

## Feedback and lifecycle

Feedback identifies authored `.nodes[n]`, `.portrait` or `.motion` fields, not
internal content/state/event boilerplate. Sorted motion events map back by their
target node. Inherited portrait geometry maps to the original authored node.
The compiler owns cut assembly, timeline identity and scene isolation; models
cannot make previous scenes linger by animating the timed clip wrapper.

The new experiment records each OpenCode response, usage, cost, check result,
feedback retry and program. Saved responses recompiled after a compiler fix
must be labeled as replays. Human-authored showcase videos are separate from
model-generated outputs. Original benchmark scores and costs remain unchanged.

No language can guarantee provider availability, a valid answer, renderer
availability or good taste. The guarantee here is deterministic validation and
a render gate for the failures it measures. Failed attempts remain visible;
there is no silent clipping, omitted essential copy or unlabeled fallback.
