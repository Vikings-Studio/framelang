# OpenCode one-shot pilot protocol

## Definition

Each assigned brief gets one fresh OpenCode invocation. The model receives an
explicit synthetic prompt and has no file or tool access. Its first response is
captured verbatim, then parsed into `program.json` by the evaluator. The model
does not compile, check, render, or revise that response. Any later engineering
diagnosis is labeled separately and never changes the first-pass outcome.

The frozen model for this pilot is `opencode-go/glm-5.3-flash` through OpenCode
1.18.29. The `oneshot` agent's effective tool map was checked with
`opencode debug agent oneshot --pure` and all read, write, shell, search, and
task tools were false. The compiler and HyperFrames versions are recorded in
the run report.
All briefs use the same fictional, self-created Atlas evidence bundle; no
customer material or unverified product claim is involved.

## Scoring

The denominator is **all assigned briefs**. Outcomes are:

1. Admitted preferred: parsed, compiled, passed all requested HyperFrames
   profiles, and rendered without compiler degradation.
2. Admitted degraded: rendered only through a declared safe presentation.
3. Typed content failure: the program or references failed FrameLang validation.
4. Structural gate failure: compilation succeeded but HyperFrames check failed.
5. Infrastructure failure: a provider, browser, FFmpeg, or storage operation
   failed independently of program content.

Separately judge rendered videos against the brief for factual fidelity,
legibility, motion clarity, visual hierarchy, and distinctiveness. A passing
quality gate alone is not a good-video score. The pilot's few examples are
diagnostic only; the RFC's larger matched A/B protocol is required before any
reliability claim.

## Reproduce

The prompt text and first model outputs are kept under `experiments/`.
Compile and check with the Node CLI documented in `README.md`. Check requires
a local browser listener; if a restricted environment returns `listen EPERM`,
rerun the identical command with local-loopback permission before diagnosing
the generated scene. Do not alter the file between first-pass scoring and
that rerun.

Cross-platform CI checks the included example on macOS, Linux, and Windows.
This Mac pilot is not evidence that all three jobs have passed.
