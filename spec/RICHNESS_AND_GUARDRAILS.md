# Rich composition and layout guardrails

The original first-shot MakeMyDemo comparison is frozen. Its strongest raw
HyperFrames clips exposed a specific gap: bold left-aligned type, emphasized
phrases, a graphic process chain, and intentional use of the frame. This
document describes the typed FrameLang controls added in response. The
[editorial example](../examples/makemydemo-editorial/program.json) and compact
[`makemydemo-workflow/v2` recipe](../examples/makemydemo-recipe-v2.json) render
the same scene in landscape and portrait. The v1 recipe is unchanged.
The later [model-expression audit](MODEL_EXPRESSION_V0_1.md) adds bounded
layered gradients, type spacing, rule shapes, and keyframes after inspecting
the saved raw model clips.

## Model-controlled choices

- Each text node chooses `style.align` (`left`, `center`, `right`), a relative
  `size`, a weight, and a color. `segments` can mark individual words with
  `foreground`, `accent`, or `accentBlock`. Text and segment content is escaped;
  CSS and HTML strings are not admitted.
- Each profile has its own `canvas` layout. A placement may use a bounded
  `[x,y,width,height]` rectangle in integer thousandths of the safe canvas or
  a `relative` placement anchored to an earlier node. Relative placement
  chooses `above`, `below`, `left`, or `right`, a gap, width, height, and
  perpendicular alignment (`start`, `center`, `end`). The compiler resolves it
  before generating CSS.
- A `flow` can select `variant: "chain"`. It shows the authored steps with
  connectors and a distinct outcome. The compiler reflows it horizontally in
  landscape and vertically in portrait. It remains compatible with the typed
  `stagger` entrance.
- The existing paint grammar supplies bounded linear and radial gradients,
  while the scene treatment controls grid, glow, rules, chrome, and ambient
  drift. The richer example combines these with a staged, hash-verified SVG,
  a typed input card, and a typed video artifact.

## Admission rules

1. Every placed rectangle must be inside its profile's safe canvas. A relative
   anchor must already have been placed; cycles and missing anchors fail.
2. Intersecting content boxes fail. Intentional overlap is admitted only when
   **both** placements declare it and at least one node is decorative. Text
   over text and functional card over functional card cannot be waived this
   way.
3. Canvas text is measured after the pinned Inter font loads. The browser
   reduces its font size to the largest fitting value, stopping at a 22 px
   floor. If it still does not fit, timeline readiness is withheld and the
   check fails. The chosen size is deterministic for the browser/font/profile
   combination.
4. A program opting into `verification: { "mode": "allFrames" }` must use a
   bounded canvas in every profile. `framelang check` requests every exported
   frame timestamp at 24 fps, transition boundaries, and media frame checks
   from HyperFrames. It rejects checker errors, missing sampled timestamps,
   **any** geometry finding (including a one-frame finding that the checker
   normally labels informational), runtime warnings such as missing animation
   targets, or a profile that did not run its layout
   audit. Only a passing report lets
   `framelang render` proceed.

This is a **fail-closed export gate**, not a claim that an arbitrary generated
program can always be repaired automatically. Invalid copy or impossible
geometry produces a concrete error for the model to fix. The browser checker
can have blind spots, and different rendering infrastructure can fail; visual
review remains required for hierarchy, pacing, meaning, and factual fidelity.
The `allFrames` mode covers rendered frame times, not continuous time between
frames.

## LLM repair feedback

`framelang lint <program.json>` is the low-cost first pass. It emits JSON with
`ok`, `findings`, and a short instruction. It collects static canvas collisions
across scenes and profiles, including the intersecting rectangle, both node
IDs, and exact source paths. It exits nonzero on a finding, so an agent can
submit the JSON to its model, revise the source, and lint again before paying
for browser checking. Bounds violations are reported in the same format.

After a valid program compiles, `framelang check <out-dir>` writes
`<out-dir>/feedback.json` even when a profile fails. Browser layout findings
are grouped by code and selector, with first/last observed times and an
occurrence count to keep repair prompts small. The compiler's selector map
points findings back to FrameLang scene, node, and profile layout locations.
Missing frame samples and runtime warnings also become findings. The full
checker report stays in `compile-report.json` for debugging; the feedback file
is the model-facing input. The model must recompile and recheck each revision.
No geometric edit is applied automatically, and rendering remains gated on
passing checks in every profile.
