# AGI Readiness

One agent. Almost any field. No babysitter.

Leul T Agonafer's definition of AGI, and a plain-language check of the [AI 2027](https://ai-2027.com) forecast against what actually happened (as of 26 September 2026).

Live: https://leultew.github.io/agi-readiness/

- `blender/build_fields.py` models the twelve field objects (plus the neutral agent) in Blender 5.2 headless and exports `public/models/fields.glb`; the site samples them into particles.
- `npm run dev` / `npm run build` (set `BASE_PATH=/agi-readiness/` for Pages).

The field tour has a skip link (shown on keyboard focus) and a numbered tick index on its
progress rule that jumps to any field (one tab stop, arrow keys move along it). All slides
stay in the accessibility tree; focusing into one scrolls it on screen.
Without WebGL, the tour and ASI sequence are ordinary document content; a captured
particle still preserves the hero. Reduced motion disables scroll pinning and
renders a static hero. Ambient particle drift only runs while the reader is scrolling
or moving the pointer and comes to rest within 2.5 s of the last input, with a
half-second ease-out. ASI text also stays in the accessibility tree throughout
its visual transitions. The mobile chart keeps its time axis below the fixed nav.

The mathematical specimen is a front-facing trefoil. The film strip uses welded
geometry and enlarged perforations so both silhouettes survive particle sampling.

After changing the hero or meshes, refresh `public/img/og.jpg` (1200×630),
`public/img/agent-still.png` and the Blender specimen plate. The particle sampler
uses a seeded generator so the point distribution is repeatable.
