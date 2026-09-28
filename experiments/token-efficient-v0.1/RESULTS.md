# Token-efficient FrameLang v0.1: local model trial

This is a new study. The original [five-model first-shot comparison](../makemydemo-v0.1/RESULTS.md)
is unchanged. All OpenCode calls used the installed 1.18.29 CLI on macOS,
hosted `opencode-go` aliases, a fresh session, temperature 0, and a
tool-disabled `oneshot` agent. The alias-to-weight revision mapping was not
independently verified. The model authored JSON only; the local FrameLang
compiler, HyperFrames checker, and renderer produced both profiles. Each
attempt's prompt, response, events, stderr, token counters, cost, and available
compile/check/render logs are retained in the stage directories. The
machine-readable [ledger](results.json) enumerates all 15 calls.

## What changed

The full cinematic program is about 17 KB of scene data. A vetted
`makemydemo-workflow/v1` recipe asks the model for only three headline lead
lines and a recipe ID. The compiler supplies the responsive layout, gradients,
staged SVG, motion, reviewed product facts, and the rest of the copy. The
[example input](../../examples/makemydemo-recipe.json) expands to the same
two-profile output as the hand-authored cinematic program. The final recipe
adds simple semantic checks: public URL in the hook, script/visuals/music in
assembly, and review-only handoff to avoid repeating the fixed export line.
It also uses a shorter input-card label and placeholder after visual review.

## Recorded attempts and costs

The initial open-ended recipe prompt was narrowed in stages. The first two
pilot attempts remain under `pilot-runs/`; the original full-scene and recipe
comparison is under `runs/`; the first four-field copy prompt is under
`copy-runs/`; and the reviewed MiMo prompt is under `final-runs/`. None of the
earlier responses or statuses was overwritten. The full-scene MiMo and
DeepSeek responses originally failed the text-overlap check. A shared
compiler text-size fix later let their **saved responses** check and render
without additional inference. That replay is a compiler improvement, not a
retroactive first-pass success.

| Model | First four-field copy attempt | Tokens (output) | Reported cost | Total recorded attempts | Cumulative reported cost |
| --- | --- | ---: | ---: | ---: | ---: |
| MiMo V2.6 Flash | Rendered both profiles | 2,565 (41) | $0.0001060136 | 5 | $0.0026276600 |
| DeepSeek V4.1 Flash | Rendered both profiles | 2,720 (43) | $0.0002590440 | 4 | $0.0052132260 |
| Tencent Hy4 Preview | Rendered both profiles | 2,685 (58) | $0.0028377430 | 2 | $0.0135378190 |
| GLM 5.2 | Rendered both profiles | 2,578 (51) | $0.0044475200 | 2 | $0.0106587200 |
| GLM 5.3 | Rendered both profiles | 2,663 (53) | $0.0048215200 | 2 | $0.0203167200 |

Those five runs prove structural render admission, not polished copy. Their
handoff leads all repeated the template's `Export MP4.` line, and some hooks
repeated the input-card wording. We did not publish those videos as finished
examples. The final MiMo attempt used a prompt that exposed the fixed
following lines and asked for a review-only handoff. It returned three
supported lines, rendered in both profiles, and reported **2,544 total tokens
(38 output, 2,112 cache-read) and $0.0000988736**. After that call, a reviewed
input-card wording change was applied to the trusted template; the saved
model JSON was recompiled, rechecked, visually reviewed, and rerendered with
**zero additional model inference**. The resulting
[landscape](preview/landscape.mp4) and [portrait](preview/portrait.mp4)
videos are the published example. The final replay had zero layout and
contrast errors in both profiles; each profile retained three known nested
structure lint warnings.

For context, the matched full-scene serialization calls used 9,656 tokens
and $0.0014752528 (MiMo), and 11,241 tokens and $0.0034341120 (DeepSeek).
Both original outputs failed the overlap check; both later rendered from
preserved responses after the general text-fit change. These are only two
pairs, with different prompt lengths and cache usage, so they are evidence
for this task rather than a general savings ratio.

The **known inference cost of all 15 study calls is $0.052354145**. This
includes rejected attempts and the two full-scene calls. It excludes local
compile/check/render time and human review. OpenCode cost is a report, not an
invoice. Cache-read tokens are included in total tokens, and the cache mix
differs among runs. No missing usage was treated as zero.

## Current cost choice

For this specific vetted MakeMyDemo workflow, use the four-field recipe and
MiMo V2.6 Flash as the first model candidate: it was the least expensive
accepted four-field result in this local roster. A second inference call is
only useful when copy or checks reject the first result; preserve each attempt
and cumulative cost. Approved copy can be compiled again without a model
call. The general expressive FrameLang grammar remains available when a video
needs a new composition, at the cost of a larger model-authored program.
