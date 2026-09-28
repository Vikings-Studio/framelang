# Independent review of the FrameLang proposal

Three reviewers examined the RFC from language implementation, video craft,
and evaluation perspectives before the pilot was built. The findings below
are decision records, not claims that the pilot implements every resolution.

| Finding | Resolution in the RFC | Pilot status |
| --- | --- | --- |
| The wire language and blueprint registry need implementable contracts. | Unknown fields are errors; a versioned registry owns finite variants and limits. | A strict executable subset is implemented. Full v1 grammar and registry are still open. |
| `sameBounds` before/after imagery conflicts with a general overlap ban. | It is an exclusive-state slot: both nodes can share geometry, but cannot be visibly active together. | Basic `replace` is implemented; framewise opacity proof remains open. |
| Recovery order was vague. | Candidate choices are finite and ordered; the compiler reports every degradation. | The pilot rejects failures; automatic safe-layout recovery remains open. |
| Box geometry cannot prove text clipping, masks, or contrast during fades. | Require rendered DOM/pixel audits alongside static geometry and a defined readable phase. | HyperFrames check covers its available layout and contrast checks; the full proof oracle remains open. |
| Product demos need footage and timed audio alignment. | Add bounded `videoClip` and a locked beat/word anchor manifest. | Neither is supported by the pilot compiler. |
| Structural pass is not creative success. | Blind video review scores factual fidelity, legibility, hierarchy, motion, and distinctiveness. | A small qualitative review is recorded for pilot videos. |
| One-shot reliability needs a clean denominator and matched comparison. | Count every assigned attempt, split preferred/degraded/content/gate/infrastructure outcomes, compare against a frozen baseline. | The included trials are diagnostic; no A/B reliability claim is made. |
| OS independence needs a precise target. | Require matching source hashes, diagnostics, acceptance, and semantic geometry across OSes; pixel identity requires a pinned renderer. | CI matrix is configured for Linux, macOS, and Windows; remote CI results remain to be observed. |

## Release decision

The RFC is a target architecture. The repository's current compiler is a
portable probe of the authoring shape and admission path. It cannot yet claim
that an agent literally cannot fail, nor that it prevents every overflow or
occlusion. A generated program can fail with a typed diagnostic; the valuable
guarantee is that an invalid artifact cannot silently become an approved
render.
