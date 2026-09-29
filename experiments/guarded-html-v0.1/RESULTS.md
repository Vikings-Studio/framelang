# Fresh FrameLang HTML authoring result

GLM5.3 generated directly for FrameLang trusted HTML admission with one call.
The source retains a typed URL field, SVG player illustration, animated tracks
and export scene. No JSON rewrite or visual source edit follows generation.

| Metric | Result |
|---|---:|
| Model calls | 1 |
| Per-video inference USD, all calls | $0.03440132 |
| Total tokens | 9,550 |
| Input / output / reasoning / cache read | 2,523 / 2,097 / 4,918 / 12 |
| Replay inference calls/USD | 0 / $0 |
| Geometry frames checked | 192 / 192 |
| Source edits | 0 |

Original harness rejection is preserved in runs/: an inherited regex treated
a URL displayed as text as a nonlocal resource. The actual FrameLang parser
accepts ordinary URL text. Replay through the CLI passes and renders. See
PROTOCOL.md. The Markdown fence was extracted; formatViolation is recorded.

This single sample is not a controlled raw-versus-framework cost comparison.
Trusted HTML permits familiar web design and measured export gates, but is not
an untrusted sandbox or deterministic-language proof. Contrast is sampled and
render compute is excluded from inference cost. No general cost advantage is
claimed. Replay metadata, actual logs, original response and video are included.
