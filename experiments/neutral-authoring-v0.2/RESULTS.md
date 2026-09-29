# Neutral authoring v0.2: results

Local Mac, OpenCode, same factual/design brief, supported low reasoning variants,
max2attempts per arm,8sec1920x1080 at24fps. Geometry requested at all192frames;
contrast sampled. Responses inside Markdown fences were extracted and the
format violation recorded. No generated source was hand-edited.

| Model | Format | Attempts | Outcome | Per-video generation USD | Total tokens |
|---|---|---:|---|---:|---:|
| deepseek-v4-1-flash | raw | 2 | check rejected | $0.023336742 | 48,478 |
| deepseek-v4-1-flash | framelang | 2 | lint rejected | $0.008449476 | 21,706 |
| glm-5-3 | raw | 1 | Rendered | $0.069879520 | 17,558 |
| glm-5-3 | framelang | 1 | Rendered | $0.027548080 | 8,243 |

Costs sum every attempt in the arm. Failed arms produced no accepted video;
these are spent generation costs, not prices of successful videos. Provider
reported inference only, excluding render compute and older redesign R&D.

## What this shows

GLM5.3's typed source cost less and passed on attempt1, but its render is less
inventive than raw: raw has a preview, play button/waveform, progress sequence
and export illustration; typed output mostly has text, a pill and a rule.
A cheaper pass is not a quality win. DeepSeek failed both arms: the typed hold
rule was inconsistent with the frozen prompt; raw had font-declaration lint
failures. See each attempt's logs and feedback, rather than guessing a timeout.

The hold mismatch makes this an exploratory pilot, not a clean controlled
benchmark. All original failures and charges are retained. Compiler repairs
were made only after this run finished. The unedited first DeepSeek typed
source is separately replayed after allowing decorative motion through the
readable hold and fixing physical circle sizing. A replay is not a new model
sample or a retroactive first-attempt success.

## Direction

Stop forcing richer raw designs through a bespoke JSON rewrite. The experimental
[source-preserving admission](../source-preserving-v0.1/README.md) copies the
accepted GLM raw source, applies FrameLang export gates, and compares decoded
frames. It adds no inference, but is trusted-source validation rather than the
typed language's stronger deterministic constraints. It is not an independent
new model comparison and does not establish broad cost savings.
