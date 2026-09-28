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

## Raw retries and repair previews

After freezing the first-shot study, we retried the two missing raw videos with
the identical prompt, model alias, temperature, and tool-disabled agent. Each
retry used a fresh OpenCode session and a separate output directory. The local
harness deadline increased from 240 seconds on attempt #1 to 480 seconds on
attempts #2 and #3. The original results and first-shot success counts above
are unchanged. `retry-results.json` records all three attempts per GLM arm;
`runs/<model>/without-framework/attempts/<number>/` preserves events, stderr,
response, token/cost metadata, and available check logs.

| Raw arm | #1 | #2 | #3 | Successful model render | Known raw inference cost |
| --- | --- | --- | --- | --- | ---: |
| GLM 5.2 | No visible response; 6,461 tokens | Check rejected: GSAP wrote `display` on a clip; 12,926 tokens | 480s harness deadline; usage unavailable | None after 3 attempts | At least $0.055385540 |
| GLM 5.3 | 240s harness deadline; usage unavailable | Check rejected: animated `letterSpacing`; 21,158 tokens | 480s harness deadline; usage unavailable | None after 3 attempts | At least $0.085433800 |

No generic service timeout is inferred. The deadline attempts ended because
the **local harness** stopped waiting; OpenCode emitted no `step_finish` usage
for them. Unknown usage is not counted as zero. The known OpenCode-reported
inference cost across all ten original arms and four GLM retries is **at least
$0.173026978**. That amount excludes local rendering and may understate actual
inference charges. It is an OpenCode report, not a provider invoice.

To make both missing videos watchable, `repair-preview.mjs` creates separate
**human repair previews** from each GLM attempt #2. For GLM 5.2 it removes one
clip `display` write; for GLM 5.3 it removes two `letterSpacing` tweens. The
script retains the model HTML unchanged, documents the edit in `repair.json`,
rechecks the edited HTML, and renders a landscape MP4. Both previews show
readable content at 2s and 6s. They are **excluded from model-success counts**
and require zero additional model inference. The MakeMyDemo side-by-side labels
them explicitly, shows attempt count, tokens, and cumulative cost per arm, and
uses lower-bound costs where usage is unavailable.

The richer FrameLang v0.1 process subset is documented in
`../../spec/V0_1_RICH_SUBSET.md`. Its landscape and portrait example is
hand-authored proof of what the compiler can express; it is not a sixth model
result or a revised first-shot score.
