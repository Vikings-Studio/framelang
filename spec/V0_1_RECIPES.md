# Token-efficient FrameLang recipes (v0.1)

A recipe is a compact, typed input to a reviewed scene program. The model
selects three headline lead lines; the compiler supplies reviewed accents,
workflow steps, profile layouts,
gradients, SVG assets, states, and motion. Full FrameLang programs remain
available when the scene needs new composition. A recipe is a versioned
creative constraint, not a general substitute for the expressive core.

The first catalog entry is `makemydemo-workflow/v1`. Its authored input is
[`examples/makemydemo-recipe.json`](../examples/makemydemo-recipe.json). It
has one recipe ID and exactly three short copy fields. The source, assembly, and delivery
headlines take the model's lead lines; reviewed accent phrases, connective
words, step labels, asset treatment, responsive layouts, and timeline come from the
[cinematic program](../examples/makemydemo-cinematic/program.json). Unknown
fields, HTML, control characters, and overlong copy fail. The pilot also checks
that the hook names a public URL, assembly names script/visuals/music, and the
handoff names review without repeating the fixed export line. These simple
word checks do not prove the copy factual or tasteful.

The compile report records the authored input hash, expanded program hash,
recipe ID, template hash, brand and asset hashes, and output hashes. The
catalog template is tied to the compiler release; a reproducible archived run
also records the repository commit. The example recipe expands to the exact
same HTML and staged assets as the hand-authored cinematic program. It does
not reduce browser render time or asset bytes. It reduces model-authored
syntax and prompt instruction surface.

This is a product-specific preset. It cannot infer whether generated copy is
factually true. New recipes need a frozen visual target, semantic copy slots,
both profile layouts, sampled render checks, and human visual review before
admission. Token savings must be measured from actual model usage and costs;
shorter JSON alone does not prove a cheaper accepted video.
