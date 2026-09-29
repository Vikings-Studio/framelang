# Model-expression v0.1 capability example

This is a separate capability demonstration, not a new model trial. The
[program](../../examples/makemydemo-editorial/model-options.json) was authored
after inspecting the saved raw HyperFrames videos. It reuses their brief and
the reviewed editorial workflow structure, and introduces typed gradient
layers, transparent stops, type tracking, a thin accent rule, and multi-point
keyframes. No new model call was made, so no new token count or inference cost
is attributed to this clip. The original five-model first-shot results and
the token study remain unchanged.

Static lint passed. On local macOS, `framelang check` observed **348 samples
per profile**, including all **276** requested 24 fps frame timestamps, with
zero layout findings, zero runtime findings, and zero contrast errors. Render
produced [landscape](preview/landscape.mp4) and
[portrait](preview/portrait.mp4) videos. Input hash, sample counts, and video
hashes are in [verification.json](verification.json). The output is a silent
workflow illustration, without real MakeMyDemo UI footage.

The [audit and language controls](../../spec/MODEL_EXPRESSION_V0_1.md) map
specific raw model choices to validated FrameLang fields. This example shows
that the compiler can render those fields; it does not prove that a model will
choose a strong composition or accurate copy. Browser checks cover sampled
rendered frames and have blind spots, and visual review remains necessary.
