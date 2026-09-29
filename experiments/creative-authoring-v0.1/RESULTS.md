# Final creative v0.1 results

Five unedited model programs produced ten8-second videos: landscape and portrait
at24fps,192frames each. Every requested frame was observed in geometry checks;
all profiles have zero geometry/runtime failures. Contrast uses its separate
sampling schedule. Final compiler replays add no inference charges.

| Model | Recorded attempts | Video from attempt | Total recorded tokens | Per-video study USD | Selected call USD |
| --- | ---: | ---: | ---: | ---: | ---: |
| DeepSeek V4.1 Flash | 8 | 8 | 77,744 | $0.0278796540 | $0.0015971940 |
| GLM 5.2 | 2 | 2 | 58,910 | $0.2375459200 | $0.1312290000 |
| GLM 5.3 | 7 | 7 | ≥56,206 | ≥$0.1751616800 | $0.0156665200 |
| MiMo V2.6 Flash | 4 | 4 | 73,288 | $0.0164956960 | $0.0021602168 |
| Tencent Hy4 Preview | 4 | 4 | 34,861 | $0.0525835260 | $0.0041395980 |

Totals include failed attempts, discarded optimization trials and visual
refinements for that model. GLM5.3 includes one local launch failure and one
480s harness deadline with missing usage; its subtotal is a known minimum.
Rendering/review compute is excluded. These refined prompts are not a controlled
cost comparison with the frozen raw reference clips.

## Visual review

- DeepSeek: stronger headline scale, accent hierarchy, readable process chain,
  distinct scene treatments, body text and supporting labels.
- GLM5.2: clear accent hierarchy and URL illustration. Outcome sizing was corrected
  in the compiler so long text cannot squeeze the process chips.
- GLM5.3: deliberate line breaks, compact body, and readable one-line brand badge
  replace the earlier crowded portrait wrapping.
- MiMo: richer rules/metadata, two staged process diagrams and supporting copy.
  Component containment and vertical-chain spacing removed portrait intrusion
  into neighboring labels and the footer.
- Hy4: four-part chain, differentiated atmosphere and a compact centered MP4 badge.

Contact sheets under `review/` show1.5,3,5.5 and7seconds. Both orientations were
reviewed against the frozen raw reference clips. The new compositions are
visibly closer in hierarchy and supporting detail; that is a review judgment,
not an automatic aesthetics score. Source JSON was never hand-designed or edited.

## Token optimization evidence

The compact design surface removes hashes, states, event/layout boilerplate and
arbitrary runtime code from model output. A shorter prompt and supported lower
reasoning variants were tested, with every trial retained. Selected DeepSeek
call8 reported6,730tokens/318reasoning/$0.001597194; its earlier admitted default
call3 reported18,851tokens/12,283reasoning/$0.008280234. This is an observed
iteration difference, not an isolated causal benchmark. GLM5.3's selected low
call7 reported7,223tokens/113reasoning/$0.01566652; default call1 reported
28,350tokens/24,269reasoning/$0.11509932 and failed layout validation.

The cumulative cost above is the honest cost of this entire improvement study
for each video, including unsuccessful optimizations. GLM5.2's default reasoning
remains expensive; the framework does not claim blanket token/cost savings.
