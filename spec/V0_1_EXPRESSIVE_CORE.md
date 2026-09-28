# FrameLang expressive core: v0.1 implementation and v1 direction

FrameLang is a declarative composition language, not a collection of fixed
title-card templates. A model can choose visual content, layout, paint, staged
assets, and motion while the compiler owns HTML, CSS, GSAP, clip timing, IDs,
and asset paths. The renderer still checks every requested profile. This file
separates what the current pilot implements from the larger v1 design.

## Implemented in the v0.1 pilot

| Capability | Program form | Bound in the compiler |
| --- | --- | --- |
| Paint | `scene.design.background` and `shape.fill`: solid, linear, or radial | Hex or frozen brand-token colors; two to five ordered stops; eight linear angles or five radial centers. |
| Text | Plain `text` or accented `segments`; optional `style` | Alignment left/center/right, four relative sizes, six font weights, token or hex color. Copy is escaped. |
| Position | `canvas` layout with per-profile child `rect: [x,y,width,height]` | Integer thousandths of the inset safe canvas; 1–16 placements; bounds must fit; both intersecting placements must declare intentional overlap. Stack, split, and overlay remain available. |
| SVG | `svg` node referencing a local manifest entry | SHA-256 hash, display permission, license, one-megabyte limit, conservative element/content filter; no runtime URL, script, style, external reference, or SMIL. The filter is not a complete XML security parser. The compiler stages the bytes and records their output hash. |
| Shapes | `panel` or `circle` with optional typed paint | No arbitrary CSS or new stacking context from a program. |
| Motion | `appear`, `replace`, or `tween` | Integer frames; finite transform/opacity values; allowlisted ease; one writer per node in the pilot; one seekable paused timeline. Typed `paste`, `reveal`, and `stagger` presets are available for the workflow templates. |
| Scene treatment | Grid/glow/rules, editorial progress rail, ambient drift | Finite compiler-owned motion; decorations are marked as intentionally clipped. |

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
compiler checks box bounds and declared overlap intent before generating HTML;
the current pilot also relies on sampled HyperFrames checks and visual review
for actual glyph fit, moving bounds, and contrast. It does **not** yet prove
all possible text or tween trajectories safe at every frame.

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
The v0.1 pilot implements the table above. Its current text fit is browser
wrapping plus sampled checks, not the full measured `wrapThenShrink` solver in
the v1 RFC. Full media, masks, path animation, audio, shaders, arbitrary SVG
authoring, and general keyframe arrays remain work to build and test.

## Determinism boundary

The strict language admits only typed programs and staged assets. A trusted
extension can widen expressivity after its own seek, geometry, security, and
cross-platform tests pass. Raw HyperFrames HTML/JS remains an escape hatch for
creative work, with its own validation result; it cannot inherit a strict
FrameLang guarantee. Even strict mode can fail cleanly when an asset is
missing, a layout is impossible, or rendering infrastructure fails. It must
never label a rejected or repaired artifact as a first-pass model success.
