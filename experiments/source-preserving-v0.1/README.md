# Preserve raw model creativity through FrameLang's export gate

This is an admission replay, not an independent inference experiment.
Source: GLM5.3 raw attempt1 from the neutral-authoring-v0.2 pilot.
The framework copies the HTML/CSS/SVG/GSAP bytes without changing the design.

| Metric | Result |
|---|---:|
| Original generation attempts | 1 |
| Original generation tokens | 17,558 |
| Per-video generation USD | $0.06987952 |
| Additional generation calls/tokens/USD | 0 / 0 / $0 |
| Geometry frames observed | 192 / 192 |
| Decoded frames identical to raw render | 192 / 192 |
| Source edits | 0 |

Original generation is counted once. Verification and rendering compute is
excluded from inference USD. Decoded frame identity was measured with FFmpeg
`framemd5`; both complete hash sequences are saved. Source and local asset hashes
are in compile-report.json. Check/render logs and the replay video are included.
Contrast is sampled by HyperFrames, not checked at every frame.

```sh
node src/cli.mjs adopt experiments/neutral-authoring-v0.2/runs/glm-5-3/raw/1/compiled /path/to/new-output
node src/cli.mjs check /path/to/new-output
node src/cli.mjs render /path/to/new-output
```

The actual DeepSeek raw attempt2 remains rejected for a font declaration error;
its feedback is included. New/modified assets or modified source invalidate
export approval. Tests exercise those invalidation cases.

Trusted HTML preserves visual freedom, but is not an untrusted JavaScript
sandbox or a deterministic-language proof. See the [mode contract](../../spec/TRUSTED_HYPERFRAMES.md).
Do not claim five-model cost savings or relabel a reused raw artifact as an
independent generated FrameLang sample. The prior JSON comparisons remain
separate, including every failed attempt and charge.
