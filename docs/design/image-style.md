# Image style sheet: ContextForge landing

- **Role in the layout:** hero background film behind the Config Composer (content layer, under a scrim). Left 45% carries the headline, so it must stay dark and quiet.
- **Aspect ratio:** 16:9, 8 s, looped ping-pong. Poster = first frame of the same clip (same light and tone).
- **Style prefix (every prompt, verbatim):** `Cinematic macro product film, dark graphite studio, matte charcoal surface, a thick slab of clear liquid glass slowly refracting thin beams of light, shallow depth of field, soft volumetric haze, slow continuous dolly from left to right, minimal composition with empty dark space on the left third, high dynamic range, calm and precise mood`
- **Palette:** background ink `oklch(0.13 0.012 262)` to `oklch(0.2 0.013 262)`; light beams lime `oklch(0.9 0.2 128)` and teal `oklch(0.8 0.12 165)`; a faint cool blue rim `oklch(0.8 0.11 235)`.
- **Light, camera, material:** single key light from the right, specular highlights on glass edges, caustics on the surface, 50 mm macro look, no cuts, no shake.
- **Negative prompt:** no people, no hands, no text, no logos, no UI, no screens, no purple or magenta neon, no rainbow gradient, no glossy cartoon 3D blobs, no particles confetti, no lens-flare starbursts.
- **Reference:** Apple Liquid Glass keynote material shots (taken for the refraction behaviour only, not composition).
- **Seed / style ID:** recorded in the run log below after generation.
- **Character / mascot:** none.
- **Batch rule:** generate in one Flow session; reject clips whose left third is busy or bright.
- **Copyright:** no artist or brand names in prompts.

## Run log

| Date | Asset | Model | Credits | Prompt suffix | Output |
|---|---|---|---|---|---|
| 2026-11-11 | hero film | Veo 3.1 - Lite, 16:9, 8 s | 10 | style prefix + "beams of lime green and teal light" + negatives | `frontend/public/media/hero.mp4` (ping-pong 16 s, 759 KB), poster = frame 0 |
