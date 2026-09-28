# MakeMyDemo v0.1 five-model comparison

The frozen brief and prompts are in `BRIEF.md` and `prompts.json`. Each model
received one FrameLang prompt and one raw HyperFrames prompt, with no agent
tools or answer repair. The OpenCode client and all checks/renders ran locally
on macOS; inference used hosted `opencode-go` model aliases. The alias-to-weight
revision mapping was not independently verified. This is a small first-response
study, not a statistical benchmark.

See `models.json` for the exact roster, public model cards, and licenses;
`results.json` for each status, token count, cost and sampled frame audit; and
`runs/` for response text, OpenCode events and stderr, generated programs,
check/render logs and rendered MP4s. GLM 5.3 uses a custom weight license with
conditions; it is an open-weight model, not a permissively licensed release.

## What counts

- A FrameLang success means its first answer parsed, compiled, passed sampled
  HyperFrames checks in landscape and portrait, rendered, and had visible
  content in sampled scene midpoints at 2s and 6s.
- A raw success means its first HTML answer passed the same sampled HyperFrames
  check and rendered in landscape, with visible content at those midpoints.
- The pixel audit is specific to this dark typography brief. It samples two
  frames and is not a universal overflow, timing, or quality proof.
- Tokens come from OpenCode `step_finish` events. The `total`, `input`,
  `output`, `reasoning`, and cache counters are copied without reinterpretation.
  OpenCode stderr is retained for diagnosing a missing answer; such a failure
  is not labeled a service timeout.

## Result

| Model | FrameLang | Raw HyperFrames | FrameLang tokens | Raw tokens |
| --- | --- | --- | ---: | ---: |
| DeepSeek V4.1 Flash | Rendered | Rendered | 3,885 | 5,047 |
| GLM 5.2 | Rendered | No response | 3,400 | 6,461 |
| GLM 5.3 | Rendered | Harness deadline | 3,291 | unavailable |
| MiMo V2.6 Flash | Rendered | Rendered | 3,487 | 5,784 |
| Tencent Hy4 Preview | Rendered | Rendered | 3,752 | 6,549 |

The GLM 5.2 raw attempt emitted a `step_finish` but no text, so its token
counter is available despite the missing response. The GLM 5.3 raw attempt
emitted only `step_start` before the 240-second harness deadline; OpenCode did
not provide a token counter. Neither result is attributed to a generic
"service timeout." The event and stderr files preserve the available evidence.

All five FrameLang answers rendered in landscape and portrait and passed the
two-frame visible-content audit. Three of five raw answers rendered in
landscape. The machine-readable table is `results.json`; the visual judgments
are in `visual-review.json`. Among the three model pairs with both videos, raw
HyperFrames generally had stronger hierarchy and product storytelling. The
FrameLang pilot's tightly constrained two-card format produced reliable but
mostly static, sparse videos. Human review also found imprecise or unsupported
copy in some admitted FrameLang videos, including Hy4's unsupported speed
claim. The pilot can reject invalid input, but it does not make AI generation
infallible or guarantee polished, factually accurate video.
