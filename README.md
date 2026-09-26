# AGI Readiness

One agent. Almost any field. No babysitter.

Leul T Agonafer's definition of AGI, and a plain-language check of the [AI 2027](https://ai-2027.com) forecast against what actually happened (as of 26 September 2026).

Live: https://leultew.github.io/agi-readiness/

- `blender/build_fields.py` models the twelve field objects (plus the neutral agent) in Blender 5.2 headless and exports `public/models/fields.glb`; the site samples them into particles.
- `npm run dev` / `npm run build` (set `BASE_PATH=/agi-readiness/` for Pages).

The field tour supports a field selector, a skip link and a “Read all” layout.
Without WebGL, the tour and ASI sequence are ordinary document content; a captured
particle still preserves the hero. Reduced motion disables scroll pinning and
renders a static hero. “Pause motion” stops the particle drift while
leaving user-driven scrolling available.

After changing the hero or meshes, refresh `public/img/og.jpg` (1200×630),
`public/img/agent-still.png` and the Blender specimen plate. The particle sampler
uses a seeded generator so the point distribution is repeatable.
