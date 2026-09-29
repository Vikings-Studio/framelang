# FrameLang expressive core: v0.1 implementation and v1 direction

FrameLang is a declarative composition language, not a collection of fixed
title-card templates. A model can choose visual content, layout, paint, staged
assets, and motion while the compiler owns HTML, CSS, GSAP, clip timing, IDs,
and asset paths. The renderer still checks every requested profile. This file
separates what the current pilot implements from the larger v1 design.

## Implemented in the v0.1 pilot

| Capability | Program form | Bound in the compiler |
| --- | --- | --- |
| Paint | `scene.design.background` and `shape.fill`: solid, linear, radial, or layered | Hex or frozen brand-token colors; two to five ordered stops, per-stop opacity, integer linear angles, typed radial centers, at most four non-nested layers. |
| Text | Plain `text` or styled `segments`; optional `style` | Alignment left/center/right, four relative sizes, six font weights, tracking, case, line height, italic, foreground/accent/accent-block spans, token or hex color. Copy is escaped. Canvas text is measured after the bundled font loads and shrunk until it fits or rejected below a 22 px floor. |
| Position | `canvas` with per-profile `rect` or `relative` placement | Integer thousandths of the inset safe canvas; 1–16 placements; relative anchors must already be placed; bounds must fit. Content boxes cannot overlap unless both declare intent and one is decorative. Stack, split, and overlay remain available. |
| SVG | `svg` node referencing a local manifest entry | SHA-256 hash, display permission, license, one-megabyte limit, conservative element/content filter; no runtime URL, script, style, external reference, or SMIL. The filter is not a complete XML security parser. The compiler stages the bytes and records their output hash. |
| Shapes | `panel`, `circle`, or `rule` with optional typed paint | Optional bounded stroke, corner, and transform origin; no arbitrary CSS or new stacking context from a program. |
| Motion | `appear`, `replace`, `tween`, or 2–5 point `keyframes` | Integer frames; finite transform/opacity values including scaleX/Y; allowlisted ease; one writer per node in the pilot; one seekable paused timeline. Typed `paste`, `reveal`, and `stagger` presets are available for the workflow templates. |
| Scene treatment | Grid/glow/rules, editorial progress rail, ambient drift | Finite compiler-owned motion; decorations are marked as intentionally clipped. |
| Process diagram | `flow` with `variant: "chain"` | Model supplies two to four steps and an outcome; compiler lays out a horizontal landscape chain and a vertical portrait chain with responsive connectors and typed stagger motion. |
| Frame sweep | `verification: { "mode": "allFrames" }` | Bounded canvas required in every profile. Check requests every exported 24 fps timestamp, transition boundaries, media frame checks, layout and contrast checks; missing reported timestamps reject the render. |

The [model-expression update](MODEL_EXPRESSION_V0_1.md) further admits up to
four layered paints with per-stop opacity, model-chosen type tracking and line
height, outlined or thin rule shapes, and 2–5 point transform/opacity
keyframes. Its example and negative tests cover those new fields; the browser
still gates render output in both profiles.

The [cinematic MakeMyDemo example](../examples/makemydemo-cinematic/program.json)
uses the general paint, canvas, text, SVG, and tween fields alongside typed URL
input and abstract video-artifact templates. Its imagery is an illustration of
the workflow, not a screenshot of the MakeMyDemo application. The original
five-model first-shot result remains frozen and is not rescored by this example.

### Example of the general composition grammar

```json
{
  "design": {
    "background": {
      "kind": "radial",
      "center": "top-right",
      "stops": [
        { "at": 0, "color": "#272815" },
        { "at": 100, "color": "background" }
      ]
    }
  },
  "layouts": {
    "landscape-1920x1080": {
      "type": "canvas",
      "children": [
        { "node": "headline", "rect": [0, 65, 1000, 215] },
        { "node": "artifact", "rect": [430, 305, 570, 650] }
      ]
    }
  },
  "events": [
    {
      "atFrame": 0,
      "durationFrames": 48,
      "effect": "tween",
      "target": "mark",
      "from": { "rotation": -12, "scale": 0.92 },
      "to": { "rotation": 8, "scale": 1.05 },
      "ease": "none"
    }
  ]
}
```

Coordinates describe a **box in the profile's safe canvas**, not arbitrary CSS
pixels. A portrait output may specify a different canvas tree. The program
cannot write a selector, `z-index`, CSS declaration, or JS expression. The
compiler checks box bounds and declared overlap intent before generating HTML.
For narrow canvas headlines, the pilot starts with a compact type tier when the
first line exceeds 20 characters. It then measures the actual loaded font in the
browser and shrinks the text to fit its box, rejecting copy that would need less
than 22 px. The `allFrames` mode checks every exported frame timestamp and
transition boundary, but the guarantee is bounded by the browser and checker:
it does not constitute a mathematical proof of every possible tween trajectory,
nor can it judge creative quality or factual claims. See
[richness and guardrails](RICHNESS_AND_GUARDRAILS.md).

## General v1 capability design

The language should cover the normal vocabulary of edited video without
making each visual treatment a one-off hardcoded component:

1. **Composition:** stack, split, grid, constrained canvas, anchored overlay,
   masks, groups, and explicit per-profile reflow. Every node has a stable
   identity, semantic importance, declared layer, and intended overlap policy.
2. **Appearance:** solid and multi-stop paints, strokes, opacity, blur and
   shadow presets, gradients, typography, vector shapes, hashed SVG, images,
   and licensed footage. Style values are typed data or frozen brand tokens.
3. **Motion:** property keyframes in integer frames, compiler-owned entrances,
   path motion, camera moves, masks, morphs, and scene transitions. Each effect
   declares affected geometry, easing envelope, property ownership, and final
   state. Motion must be seekable from any frame without replay or clocks.
4. **Media:** staged image, SVG, video, and audio manifests with hashes,
   dimensions, license/display rights, source range, crop/focal metadata, and
   locked narration/music timing. Playback and mixing remain framework-owned.
5. **Effects:** deterministic, versioned extensions for particles, shaders,
   3D, or custom generators. An extension declares inputs, supported profiles,
   maximum swept bounds, resource limits, and a conformance suite. It cannot
   fetch data or execute arbitrary model-authored code at render time.
6. **Proof:** compile-time schema and reference checks, geometry and motion
   audits per profile, sampled renderer checks, shuffled-frame seek tests,
   actual export verification, and human review for factuality and taste.

This is a capability map, **not a claim that every item is implemented**.
The v0.1 pilot implements the table above. Full media, masks, path animation,
audio, shaders, arbitrary SVG authoring, and property-specific keyframe easing
remain work to build and test.

## Determinism boundary

The strict language admits only typed programs and staged assets. A trusted
extension can widen expressivity after its own seek, geometry, security, and
cross-platform tests pass. Raw HyperFrames HTML/JS remains an escape hatch for
creative work, with its own validation result; it cannot inherit a strict
FrameLang guarantee. Even strict mode can fail cleanly when an asset is
missing, a layout is impossible, or rendering infrastructure fails. It must
never label a rejected or repaired artifact as a first-pass model success.
