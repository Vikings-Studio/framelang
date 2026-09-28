# Atlas pilot observations

These are three diagnostic, tool-disabled OpenCode one-shot attempts on a
fictional brand. They are not the MakeMyDemo five-model comparison and are too
small to estimate a reliability rate.

| Attempt | First-pass result | Render |
| --- | --- | --- |
| Unguided typography, GLM-5.3-Flash | Typed failure: scene ID `scene_hook` violates the ID grammar. The response also represented `content` and `states` as objects instead of arrays. | None. |
| Explicit-schema typography, GLM-5.3-Flash | Compiled and passed HyperFrames checks in landscape and portrait. | [Landscape](runs/type-teaser-guided/video-landscape.mp4), [portrait](runs/type-teaser-guided/video-portrait.mp4). |
| Explicit-schema before/after, GLM-5.3-Flash | Compiled and passed HyperFrames checks in landscape and portrait after a compiler-only state-switch correction. The first model response was never edited. | [Landscape](runs/product-reveal/video-landscape.mp4), [portrait](runs/product-reveal/video-portrait.mp4). |

Both admitted programs rendered at 24 fps for 8 seconds. HyperFrames reported
zero layout issues at its sampled frames and passing contrast samples, with
two `nested_structure_needs_subcomposition` lint warnings per profile. Motion
auditing and snapshots were disabled. These checks do not constitute the
RFC's framewise semantic proof.

The video reviewer found the typography clip too static, the portrait canvas
underused, and the before/after UI too small in portrait at ordinary viewing
size. Neither clip has audio. The result supports a narrow claim: explicit
array and ID constraints helped this model produce renderable programs, while
the current blueprint and compiler did not produce a strong promotional video.

The initial before/after emitter created a visible blank transition. Frame
inspection caught it despite a passing structural check; the emitter now
switches the exclusive states at one frame. This is a concrete example of why
v0.1 must include visual review as well as automated admission.
