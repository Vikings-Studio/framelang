# Model expression: raw clip audit and bounded FrameLang controls

This update uses the saved first-shot raw HyperFrames outputs in
[`experiments/makemydemo-v0.1`](../experiments/makemydemo-v0.1/RESULTS.md),
not new model calls. Three raw arms rendered directly. The two GLM raw arms
required human repair previews or produced no video, so their edited previews
are not counted as autonomous success. The later editorial FrameLang clip is a
human-designed capability example, not a matched model result.

| Raw model observation | New model-controlled field | Safety boundary |
| --- | --- | --- |
| MiMo layered gradients and a soft accent wash; Hy4 grid and glow | `paint.kind: "layers"` with up to four typed paints, arbitrary integer linear angle 0–359, radial center `[x,y]` in percentages, and per-stop opacity 0–100 | No authored CSS, external URL, shader, or unbounded stack. The compiler emits CSS from validated values. |
| DeepSeek and MiMo used wide uppercase labels, tight large headlines, and deliberate line spacing | Text `style.tracking`, `case`, `lineHeight`, and `italic` | Closed values; text is escaped and measured after font load. Unfit copy fails the browser check. |
| DeepSeek's thin accent rule and MiMo's boxed process labels | Decorative `shape.primitive: "rule"`, optional typed `stroke`, `corner`, `origin`, and transparent fill | Canvas bounds and overlap lint still apply. A functional node cannot overlap another functional node by opting out. |
| Raw clips staged rule growth and secondary settling motion | `effect: "keyframes"` with 2–5 points, or `tween` with `scaleX`/`scaleY` | Integer frame positions, 1 writer per node, identical typed properties at each point, finite bounded values, compiler-owned seekable timeline, and browser geometry check. |

The [model-options program](../examples/makemydemo-editorial/model-options.json)
uses these fields in landscape and portrait. `framelang lint` checks static
geometry, and `framelang check` audits every requested 24 fps frame because the
program opts into `allFrames`. Failed checks produce `feedback.json` for an LLM
revision loop and block rendering. This design lets the model choose a visual
treatment while the compiler owns rendering code and the checker rejects
observed overflow or collision.

The [capability result](../experiments/model-expression-v0.1/RESULTS.md)
records 348 local samples per profile with no geometry or runtime findings,
plus the rendered landscape and portrait videos. It contains no new inference
cost because the visual program was authored as an implementation example.

The saved GLM 5.2 and GLM 5.3 raw retries illustrate a boundary: their HTML
was rejected for GSAP writes to `display` and `letterSpacing`. FrameLang
admits letter spacing as a **static style**, while its animation grammar only
admits transforms and opacity. Masks, arbitrary DOM, video footage, arbitrary
SVG generation, and CSS filters are still outside this v0.1 subset. The raw
videos remain a qualitative reference; this update does not change the frozen
first-shot scores or establish a new token-cost comparison.
