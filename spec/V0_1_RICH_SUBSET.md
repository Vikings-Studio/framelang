# FrameLang v0.1 rich process subset

This implemented subset addresses a visible limit in the first MakeMyDemo
five-model comparison: raw HyperFrames responses used stronger type hierarchy,
color emphasis, atmospheric framing, and a staged product flow. The original
one-shot results remain immutable. The new `examples/makemydemo-rich/program.json`
is a hand-authored demonstration of compiler expressivity, **not** a model
first-shot result.

## Accepted fields

All existing v0.1 fields remain valid. The additions are closed enums and
bounded arrays; arbitrary CSS, HTML, and JavaScript are not accepted.

- `scene.blueprint: "product-process/v1"` admits `flow` nodes.
- `scene.design` may contain `alignment: "left" | "center"`,
  `scale: "standard" | "display"`, and
  `decoration: "none" | "rules" | "grid-glow"`. Omitted fields use the
  original centered standard style without decoration.
- A `text` node may use `segments` in place of `text`. Each segment has plain
  `text`, optional `tone: "foreground" | "accent"`, and optional
  `breakAfter: boolean`. There are at most eight segments, at most 120
  characters each and 240 characters total. `breakAfter` on the final segment
  is invalid. The compiler escapes text and emits a line break only when
  explicitly requested.
- A `flow` node has two to four plain-text `steps` (up to 28 characters each)
  and one plain-text `outcome` (up to 36 characters). It renders as a bounded
  chip sequence, arrow, and outcome. Portrait stacks the sequence vertically.
- An `appear` event may choose `preset: "rise" | "slide" | "pop" | "fade" |
  "stagger"`. `stagger` applies only to a flow node, reveals its steps in
  order, and uses one seekable GSAP timeline. `replace` does not accept a
  preset. The default remains `rise`.

The compiler derives colors from the frozen brand bundle and dimensions from
the selected output profile. Input may not supply numeric positions, CSS, or
remote assets. Existing state, event-order, duplicate-writer, asset-hash, and
render-gate rules still apply. The CLI checks both output profiles before it
renders either one.

## Evidence and boundary

`npm test` covers compilation of both profiles and rejection of malformed
rich nodes. `npm run rich:compile`, `npm run rich:check`, and
`npm run rich:render` generate the MakeMyDemo example. The sampled HyperFrames
check found no layout or contrast errors in either profile, and both videos
rendered. Human review found large type, accents, grid/glow framing, and the
script/visuals/music process readable without visible clipping. That review
also prompted a copy correction so the flow ends at a **video first cut**, and
the MP4 appears at export after review.

The subset covers those observed composition features. It does not prove that
arbitrary raw HyperFrames designs can be expressed, that every possible
string fits in every composition, or that model-authored programs will always
select good copy and motion. Sampled layout checks and human review are still
required before a video is presented as polished.
