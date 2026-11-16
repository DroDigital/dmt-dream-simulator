# DMT: Dream Simulator — Game Design Document

Nov 15, 2026 · @Alessandro

## Verdict: skip ASCII Magic Pro for this game

You can build DMT: Dream Simulator entirely from free assets and open-source code, so the Pro sub isn't needed. [ASCII Magic](https://www.ascii-magic.com/app) is a browser editor that stylizes a photo or video you load into it, then exports it (the page says up to 4K). It bakes images; it doesn't give you a real-time shader that runs on a live 3D world, and a game needs exactly that.

The ASCII page also lists no prices, export formats or license terms for commercial or game use. Paying for it before you know if you can ship its output would be a gamble.

What replaces it here, all free:

- **Glyph shader:** ASCII, braille, dither and halftone looks as a real-time post-process we write in TSL (about 80 lines). It runs every frame on the moving world (see Shaders).
- **Engine:** Three.js with WebGPURenderer and TSL, MIT licensed.
- **3D and textures:** CC0 packs from Kenney, Quaternius, KayKit, Poly Haven and ambientCG (see Asset sourcing).
- **Audio:** the Sonniss GDC bundles, Kenney audio and CC0 sounds on Freesound.

Where ASCII Magic still fits: concept stills, Steam capsule art or trailer frames. Buy it later for that, and only after you've read its terms.

## Vision

DMT: Dream Simulator is a first-person "playable dream": 365 nights for 1 to 4 players on one screen, each lasting 3 to 10 minutes, where touching anything carries you somewhere else. In-world, DMT stands for **Dream Memory Transit**, the way LSD's makers said their title meant "Link Speed Dream".

**Pitch:** PS1 bones in modern light. The geometry is low-poly, wobbly and hand-made; the light is soft bloom, volumetric haze, iridescent film and smeared afterimages. We call the look **Lucid Lo-Fi**. Screenshots should read as a half-remembered 1998 game seen through stained glass at dawn.

### Design pillars

1. **Every surface is a door.** Walk into a wall, a tree or a person and the world links elsewhere. No menus, keys or inventory.
2. **Wonder, absurdity and unease, in turns.** A beautiful moment, then a silly one, then one that's quietly wrong. Ordinary places carry most of the strangeness.
3. **Never the same twice, always half-familiar.** Every run reshuffles the world; every night rolls new laws, events and textures; landmarks and motifs recur so it still feels like your dream.
4. **Smooth as breathing.** Locked 60 fps, eased camera, and no hard cuts: every link is a melt, fold or bloom-out.
5. **No words.** No quest text and no HUD. The Dream Journal and the Resonance chart are the only interface.
6. **Dream together, drift apart.** 1 to 4 players share a night on one screen. They can wander into different realms and find each other again.

### What we take from LSD, and what we change

| LSD: Dream Emulator (1998) | DMT: Dream Simulator |
| --- | --- |
| Linking: bump into things to jump areas | Kept, plus "gaze links": stare at an object 3 s to drift into it |
| Dream chart, 4 quadrants (Upper/Downer, Static/Dynamic) | Resonance chart: Bright/Deep × Still/Alive, drives palette and next start |
| Grey Man erases the dream from Flashback | The Watcher, who erases the night from Afterimage |
| Flashback mode after about 20 days | Afterimage, unlocked at night 20 |
| White flash between areas | Liquid transitions: melt, fold, iris, pour (shader-driven) |
| 15 fps, 320×240 | Internal 480×270 lo-fi buffer, upscaled, at 60 fps |
| Texture sets swap at random | Texture sets plus palette moods, shifted by Resonance |
| No accessibility options | Photosensitivity mode, motion-comfort settings, colour-blind palettes |

The LSD rows are summarised from [Hardcore Gaming 101](https://www.hardcoregaming101.net/lsd-dream-emulator/), the [Dream Emulator wiki](https://dreamemulator.fandom.com/wiki/Dream) and [PSX Datacenter](https://psxdatacenter.com/games/J/L/SLPS-01556.html).

### Closer to the original

This pass pulls the game back toward LSD's mix of the mundane, the absurd and the eerie, away from pure polished awe. We echo its structure and spirit; its places, art, music, characters and text stay untouched.

| What makes LSD feel like LSD | How DMT echoes it, in its own way |
| --- | --- |
| Ordinary places turned strange | Two realms are now everyday places, Evening Suburb and Night School. Every realm has at least one mundane anchor: a vending machine, a bus stop, a laundry line |
| Bump into something and you're elsewhere, instantly | Contact links fire on touch, no delay. Melts are cut to 0.6 s, and an "Instant" option gives a hard fade like the original |
| The chart changes what the world looks like | Four texture moods per realm, picked by chart quadrant, plus texture drift across nights |
| Small odd events and creatures appear at random | An event deck of 200+ micro-events: funny, tender, eerie, pointless (see Replayability) |
| Short video interludes | Visions now include absurd ones, shown with a worn-tape look |
| The day count changes what can happen | Night-number events and long arcs: motifs evolve, realms age, new variants appear |
| Flashback / the Grey Man | Afterimage / the Watcher |
| Built from a real dream diary | **The Dream Diary:** 365 short fragments written from real dream journals by the team and community. One is shown at each waking, and its keywords seed that night's event deck |
| Deadpan, never explains itself | No tutorial text. The title screen asks only "Sleep?" |
| Cheap-looking yet unforgettable | The hi-fi light layer is tuned per realm: mundane realms stay flat and plain, so the glow surprises when it arrives |

## Worldbuilding

The world is **the Transit**: a city-sized machine, made of light, that sorts every memory anyone has ever dreamed. You visit it 365 nights in a row. Nothing is explained in words; the lore lives in places, recurring images and the journal.

### The premise

- **The Sleeper (you)** lives in the Lantern Flat (alone, or with up to three other dreamers in co-op), a seventh-floor apartment in a city that never existed. Each night you lie down and slip into the Transit.
- **The Transit** has layers. Bright layers float high and are warm and open. Deep layers sink low; they're older, quieter and stranger. Your Resonance (see Core loop) decides how high or deep you begin.
- **The Lanternfolk** keep the machine running: gentle geometric beings who fold, sort and polish memories. They are the closest thing to inhabitants.
- **The Threshold** is a doorway that appears only after you've seen all 12 realms. Reaching it on night 365 ends the cycle, then the game continues in New Dream+ with remixed seeds.

### Rules of the dream

1. **Touch links.** Contact with almost anything carries you on. Where you go depends on what you touched, where you stand on the chart and a seeded roll.
2. **Light has weight.** Brighter realms sit higher. Climb to drift Bright; descend stairs, wells and holes to drift Deep.
3. **Gravity is a suggestion.** Walk up a 60° slope and the world slowly turns until it's floor.
4. **Things remember.** An object you touched glows faintly the next time it appears, in any realm.
5. **Falling isn't death.** You land, softly, in a Deep realm. There is no fail state.
6. **The night breathes out.** When the timer ends, the camera rises, the world dissolves into motes and you wake in the Lantern Flat.
7. **The sky is the calendar.** A slow fractal mandala overhead turns one notch per night; on night 365 it closes.

### Recurring motifs

All original to this game; each recurs across realms so players build their own mythology.

- A red paper kite that's always just out of reach
- A night train whose windows show other realms
- A woman whose face is a paper lantern
- A telephone that rings in every realm, the same tone each time
- A pair of moons that slowly trade places over the 365 nights

### Tone

Tender, vast, lonely, playful. Think a planetarium at 3 a.m., or a cathedral made of soap film. Low nights may be eerie but never gory or cruel.

## Core loop & systems

One night is one short dream. You start in a realm picked from yesterday's Resonance, link from realm to realm by touch, and wake when the breath timer runs out. Waking plots the night on the chart and writes a journal page.

&#91;embedded content: one night · the link loop and two ways it ends\]

A typical night is 4 to 8 links. The Watcher can end one early and wipe its Afterimage.

### Linking

- **Contact link:** touching a linkable mesh (about 90% of objects) links instantly, as in the original. Floors, your own futon and other dreamers never link.
- **Gaze link:** hold the centre of view on an object for 3 s. It pulses, then pulls you in. There's no reticle.
- **Destination:** every object carries tags: water, light, paper, glass, flesh, glyph, machine. A weighted table maps tag to realm. Resonance shifts the weights and the night's seed rolls the result.
- **Transition:** the tag also picks the transition shader. Water pours, paper folds, glass refracts and shatters, light blooms out, glyph dissolves into text. Each takes 0.6 s; an Instant option swaps them for a hard fade.
- **Rush:** 5 links within 60 s counts as a rush and pushes Alive.

### Resonance chart

&#91;embedded content: Resonance chart · four moods and their starting realms\]

The chart is a 9 × 9 grid with two axes: Bright to Deep, and Still to Alive. Your position moves live during the night and tints the palette as it moves. At waking it's plotted as a dot that fades after 60 nights, so the chart can never be completely filled.

| Event during the night | Push |
| --- | --- |
| Touch a Lanternfolk | Bright +1 |
| See a Vision | Bright +2, Alive +2 |
| Climb 20 m above the spawn height | Bright +0.5 |
| Fall, or go underground | Deep +1 |
| Meet the Watcher | Deep +2 |
| Stand still for 20 s | Still +1 |
| Chain 5 links in 60 s | Alive +2 |
| Wake in the realm you started in | Still +1 |

### Nights and unlocks

Each realm has its own timer, 3 to 10 minutes. It's never shown as a number; the sky slowly brightens instead.

| Night | Unlock |
| --- | --- |
| 1 | Lantern Flat, the four quadrant starting realms, photo mode |
| 10 | Gaze links |
| 20 | Afterimage replay |
| 50 | Photo-mode lenses and palettes |
| 100 | Visions rise from 1 in 40 links to 1 in 25 |
| 200 | Deep variants of every realm |
| 365 | The Threshold |

### Afterimage

Afterimage replays the previous night from its seed. Take the same links and you get the same dream; deviate and it branches. Meeting the Watcher erases that night's Afterimage. A night's seed plus link log is about 2 KB, so all 365 nights are kept.

### Visions

Visions are rare real-time set pieces; LSD used short video clips for the same job. There are 20, each 20 to 40 s long. Examples: a whale of light swims through the streets; the sky unzips to show a second sky; every object folds into a paper crane and flies away.

### Dream Journal

Each waking adds a page: a polaroid of the night's most striking frame, a 3-line poem, the chart dot and the night number. The frame is picked by scoring contrast, saturation and motion once per second. The poem is assembled from phrase tables keyed to the tags you touched. Pages export as PNG.

### Controls

| Action | Keyboard and mouse | Gamepad |
| --- | --- | --- |
| Walk | WASD | Left stick |
| Look (heavily smoothed) | Mouse | Right stick |
| Drift faster | Shift | L3 |
| Float, slows a fall | Hold Space | Hold A |
| Quick 90° turn | Q / E | LB / RB |
| Photo mode | F | View |
| Interact: hold hands, carry, answer the phone | E | X |

## Local co-op (1 to 4 dreamers)

Up to 4 players dream the same night on one screen, each in first person. They share the night's seed, timer and Resonance, but each links on their own, so the group drifts apart and finds its way back together. Anyone can drop in or out at the Lantern Flat. Steam Remote Play Together lets friends join over the internet as if they were on the couch.

### How a shared night works

| System | Solo | Co-op |
| --- | --- | --- |
| Seed and timer | Yours | Shared; one timer for the group |
| Linking | You go | Only the dreamer who touched goes. Others can follow by touching the same object within 10 s, or stay |
| Linking together | — | Two dreamers holding hands (both hold Interact while touching) link as one |
| Resonance | One dot | Each dreamer leaves a coloured dot; the group dot is their average and sets tomorrow's start |
| Divergent nights | — | If dreamers end more than 4 cells apart on the chart, the next night starts each in their own realm |
| The Watcher | Ends your night | Walks past one dreamer. If he reaches them, only they wake; their pane becomes a small sleeping window that watches the others |
| Afterimage | Replays your night | Replays everyone's links. Watcher contact with anyone erases it for all |
| Journal | One page | A two-page spread: each dreamer's polaroid and one poem line each |

### Co-op-only moments

- **Reunions:** two dreamers who've been apart for 2+ minutes meet, and the realm blooms around them. Bright +1 for both.
- **Chorus links:** some objects (the big bell, the cathedral doors, the night train) link only when 2, 3 or 4 dreamers touch them at once. They open co-op-only rooms and Deep variants.
- **Echoes:** a dreamer in another realm shows as a flickering silhouette in thin spots of yours: mirrors, water, the Static Field's TVs.
- **The shared telephone:** whoever answers the ringing phone hears the other dreamers' realms through it.
- **Lantern trails:** Lanternfolk follow the dreamer who touched them most, leaving a light trail others can follow.
- **Nothing to lose:** no competition, no friendly fire, no fail state.

### The dreamers

Four original player figures, each with its own accent colour locked into every palette. Others see you as a soft glowing figure; in solo, your reflection is your chosen dreamer.

| Dreamer | Silhouette | Trail |
| --- | --- | --- |
| Moth | Pale coat that opens into wings when floating | Dust motes |
| Kite | Diamond-shaped head, long ribbon tail | Ribbon light |
| Bell | Bell-shaped cloak that chimes as it moves | Ripples of sound rings |
| Crane | Paper crane mask and folded cape | Paper flakes |

Build each from a Quaternius base character, a procedural accessory mesh and an emissive outline in the dreamer's colour.

### Split-screen

&#91;embedded content: split-screen layouts · 2 players, 4 players, bubble panes\]

Two players split side by side; three or four use quarters (three leaves the fourth quarter showing the sky mandala). Seams are soft glows in both dreamers' colours, not black bars. Optional **bubble panes** let a pane grow when its dreamer sees a Vision or hits a chorus link, and shrink when they stand still or wake. Sizes move on springs over 1.5 s, and no pane drops below 20% of the screen. Pane links wipe with that realm's transition, only inside the pane.

### Controls and profiles

- One gamepad per player; keyboard and mouse counts as one player. The Gamepad API handles 4 pads.
- Join: press any button at the Lantern Flat and lie down on a free futon. Leave: hold Start for 2 s.
- Per-player settings: look sensitivity, invert, field of view, and gentle mode, applied to that player's pane only.
- A household save holds the shared night count plus up to 4 dreamer profiles, each with its own Atlas progress.

### Technical notes

- Each pane has its own camera and its own 480 × 270 lo-fi scene pass. Four panes cost about as many pixels as one 1080p frame divided by four, so the lo-fi body scales well.
- Dreamers in different realms keep up to 4 realms in memory at once, about 100 MB.
- One set of speakers: each pane's realm is mixed in, panned toward its side of the screen and weighted by pane size.
- The 4-player preset runs fog at quarter resolution and ray-marching only in the pane that needs it (see Performance).

## Realms

The Transit has 12 realms plus the Threshold. Each is a hand-built "anchor" layout (about 200 × 200 m) that procedural props, palettes and texture sets dress differently every night. Each realm also has a Deep variant, unlocked at night 200.

| # | Realm | Mood | What you see | Signature technique | Main link tags |
| --- | --- | --- | --- | --- | --- |
| 0 | **Lantern Flat** | Hub | A small seventh-floor apartment of paper lanterns, a futon and a window onto an impossible city. You wake here every morning. | Baked light, window parallax onto a ray-marched city | (bed only) |
| 1 | **Cloud Orchard** | Halo | Pastel trees whose fruit are tiny ringed planets, on islands of cloud | Volumetric clouds, instanced foliage with wind | light, glass |
| 2 | **Lantern Market** | Bloom | A night bazaar of floating stalls run by Lanternfolk; music from everywhere | 2,000 instanced lanterns, bloom, crowd shader animation | light, paper |
| 3 | **Prism Cathedral** | Halo | An endless stained-glass nave where light shafts turn into rainbows on the floor | God rays, caustics, dispersion shader | glass, light |
| 4 | **Evening Suburb** | Bloom | An ordinary street at 6 p.m. that never ends: bikes, vending machines, laundry lines, and houses that repeat a little too often | Modular house kit with near-repeats, long-shadow sunset light | paper, machine |
| 5 | **Tidal Stair** | Centre | A white staircase descending forever into a glowing sea under two moons | Gerstner waves, subsurface glow, reflection | water |
| 6 | **Origami Metro** | Alive | A paper city that folds and unfolds around a night train | Vertex fold animation, paper fibre texture, toon edges | paper, machine |
| 7 | **Drowned Library** | Hush | Sunken stacks where books swim like fish; slow, green light | Underwater caustics, boids, depth fog | water, paper |
| 8 | **Static Field** | Hush | A meadow at dusk where old TVs grow like flowers, each showing another realm | Render-to-texture portals, VHS noise, scanlines | machine, glyph |
| 9 | **Fractal Reef** | Undertow | Ray-marched coral that breathes and branches forever | Mandelbulb and Kaleidoscopic IFS ray marching, iridescence | flesh, water |
| 10 | **The Veins** | Undertow | Warm iridescent tubes that pulse with light, half organism, half pipe organ | Displacement, thin-film iridescence, heartbeat-synced audio | flesh, machine |
| 11 | **Glyph Desert** | Deep | Dunes, sky and wind drawn entirely in moving characters; your footprints are words | The glyph shader as the whole realm (our free ASCII Magic replacement) | glyph |
| 12 | **Night School** | Still | An empty school after dark: corridors that loop, classroom doors that open onto other realms, a piano playing somewhere | Portal rendering, stencil buffers, long shadows | all |
| — | **The Threshold** | (none) | A single doorway of white light on the sky mandala's centre; seen only on night 365 | Every shader in the game layered at once, then silence | — |

### Realm rules

- **Each realm has a landmark** seen in no other realm, so players can orient themselves: the cathedral's rose window, the market's gate, the reef's spiral.
- **Each realm has 4 texture moods, 4 eras and 4 palette moods.** The chart quadrant picks the texture mood, the night number sets the era, and Resonance tilts the palette.
- **Each realm has one hidden "quiet place"**, such as a bench or a window, where standing still 20 s plays a short ambient motif.
- **Realm timers** run 3 min (Night School) to 10 min (Lantern Market).

## Characters & entities

Nine entities, each built from a free base mesh or pure code, and each readable by silhouette alone at 480 × 270. None speaks. They communicate by light, motion and sound.

| Entity | Look | Behaviour | Build from |
| --- | --- | --- | --- |
| **The Sleeper** (you) | Never seen directly. In mirrors and water: a soft silhouette filled with the current palette, edges smeared | Your reflection lags 0.3 s behind you | Quaternius Universal Base Character + dither-dissolve smear shader |
| **Lanternfolk** | 1.2 m beings: a folded paper polyhedron body, a glowing lantern head with a one-line face | Fold, sort and carry glowing objects; briefly follow you; tumble rather than walk | Pure code: procedural polyhedron, ambientCG paper texture, SDF emissive face |
| **The Watcher** | 2.4 m tall, long coat; his whole body is a hole showing the scene behind him, colour-inverted and full of static | Walks one direction only and never turns. The music thins as he nears. Contact ends the night and erases its Afterimage | Quaternius base mesh, stretched; screen-space invert-and-static material |
| **Lantern Woman** | A woman in a plain dress whose head is a paper lantern | Always at a window or doorway, facing away. Turns toward you only on the brightest nights | Quaternius or PolygonalMind avatar, lantern head swap |
| **Paper Conductor** | An origami figure in a conductor's cap | Rides the night train; waves when it passes; touching the train links to Origami Metro | Kenney/KayKit train + procedural fold shader |
| **Drifters** | Jellyfish of soft light, 0.5 to 4 m | Drift in flocks over the Cloud Orchard and Tidal Stair; part around you | GPU compute particles + ribbon tentacles |
| **Book-fish** | Open books flapping their pages like fins | Shoal in the Drowned Library, scatter when you run | Instanced book mesh (Kenney/Poly Pizza) + boids in a compute shader |
| **Moth Choir** | Hundreds of pale moths that settle on lamps | Settle and hum a chord; burst into the air when you link | GPU particles; each moth is a 2-triangle sprite |
| **Whale of Light** | A 200 m whale made of constellations | Vision only: swims slowly through a realm's sky, singing | Point cloud from a CC0 whale model, additive points, trails |

### Character design rules

1. **Silhouette first.** Each entity has a shape no other shares: polyhedron, column, lantern, ribbon.
2. **Procedural motion over keyframes.** Sine-driven bobbing, spring-damped heads, and IK feet keep it smooth and cheap; Mixamo-style clips only for the humanoids.
3. **Light is the face.** Emotion is shown by glow intensity and colour temperature, not by facial animation.
4. **No jump scares.** The Watcher is unsettling because he ignores you, not because he chases you.
5. **Original only.** No borrowed designs from LSD or anywhere else; the Watcher plays a similar role to LSD's Grey Man but looks nothing like him.

## Art bible

The signature is **chunky inside, silky outside**: geometry and textures render at a low internal resolution with PS1 wobble, while light, haze, trails and glyphs are composited on top at full resolution. That split is what makes the look ours. Retro filters alone look like a filter; this looks like memory glowing.

### The three layers of Lucid Lo-Fi

1. **Lo-fi body:** 480 × 270 internal buffer, vertex snapping, affine texture wobble, 128 px textures quantised to 32 colours, nearest-neighbour upscale.
2. **Hi-fi light:** full-resolution bloom, volumetric fog, god rays, thin-film iridescence and soft emissive gradients, all computed from the full-res depth and emissive buffers.
3. **Dream lens:** temporal feedback trails, chromatic fringing, slow kaleidoscopic breathing at the screen edges, palette grading from the Resonance position.

### Palettes

Each quadrant has a 5-colour key palette baked into a 3D colour LUT. The live palette is a blend of the four LUTs, weighted by the night's current chart position, so colour drifts as you play.

| Quadrant | Feel | Key colours (hex) |
| --- | --- | --- |
| Halo | Dawn, pastel, milky | #FFF4E6 cream · #FFC9DE blush · #BDE7FF sky · #D9C8FF lilac · #FFE7A3 butter |
| Bloom | Festival, saturated | #FF3D7F magenta · #FFB000 amber · #00E0C6 teal · #7A5CFF violet · #FFF27A lemon |
| Hush | Underwater dusk, one warm lamp | #0E1A24 ink · #2E5E6E deep teal · #8FB8B0 sea glass · #C9D6D2 fog · #E8C27A lamp |
| Undertow | Dark neon, pressure | #0A0614 void · #FF2E9A hot pink · #19F0FF cyan · #6B1FFF ultraviolet · #B6FF3B acid |

### Materials

- **Nothing is fully opaque or fully dark.** Every material has a little emissive or translucency so shadows glow rather than go black.
- **Five material families:** paper (fibre texture, light bleeds through), glass (dispersion, refraction), clay (matte, soft rim light), film (thin-film iridescence), glyph (characters instead of pixels).
- **Textures** come in at any size and are downsampled to 128 px and palette-quantised on import, so assets from different packs share one look.

### Camera and motion

- 75° field of view that "breathes" ±1.5° at 0.2 Hz.
- Look and movement run through critically damped springs; nothing snaps. A slight roll on turns, capped at 3°.
- Everything is always moving a little: vertex wind, drifting motes, a turning sky. A frozen frame should still look alive.
- Transitions last 0.6 s and are continuous (Visions up to 2 s); an Instant option gives an original-style hard fade.
- Composition leans on huge scale contrast, strong horizons and symmetry, which reads well at low resolution.

### Type and journal

- Journal text: Cormorant Garamond. Glyph realm and debug: VT323. Both are free under the SIL Open Font License.
- The journal page is a cream paper texture with a polaroid, hand-drawn chart and three lines of verse.

### Influences, not copies

Osamu Sato's LSD: Dream Emulator, Yume Nikki, James Turrell's light rooms, teamLab installations, Hilma af Klint's diagrams and Moebius's colour. We take moods and principles from them, never imagery.

### Photosensitivity

No full-screen flash faster than 3 per second; luminance jumps are clamped per frame. A "gentle mode" lowers feedback trails, chromatic fringing and screen breathing, and swaps flash transitions for slow fades. A warning screen shows on first launch.

## Shaders & rendering

Every effect is written in TSL, Three.js's shading language. TSL is written in JavaScript and [compiles to WGSL for WebGPU or GLSL for WebGL](https://app.cinevva.com/news/2026-03-18-threejs-r183-render-pipeline), so one codebase covers new and older GPUs. Post-processing runs through `RenderPipeline`, which replaced `PostProcessing` in r183 and handles multiple passes and history buffers.

### Frame order

1. **Scene pass at low resolution** (480 × 270) with multiple render targets: colour, emissive, depth, normals.
2. **Lo-fi materials** inside that pass: vertex snapping and affine UV wobble.
3. **Palette quantise + 4×4 Bayer dither** on the low-res colour.
4. **Nearest-neighbour upscale** to native resolution.
5. **Full-res light**, from the emissive and depth targets: bloom, volumetric fog, god rays.
6. **Realm effects:** the glyph pass, kaleidoscope fold, underwater caustics.
7. **Feedback trails** from the previous frame's history buffer.
8. **Resonance grade:** four 3D LUTs blended by chart position.
9. **Lens:** chromatic fringe, vignette, film grain.
10. **Transition compositor:** during a link, both realms render and a mask shader blends them.

### Shader catalogue

| Shader | What it does | How | GPU cost |
| --- | --- | --- | --- |
| Vertex snap | PS1 jitter: vertices pop between screen pixels | Snap clip-space XY to a 240 × 135 grid in `vertexNode` | Tiny |
| Affine wobble | Textures swim across big polygons | UV varying with linear (no-perspective) interpolation | Tiny |
| Quantise + dither | 32-colour look, smooth gradients | Bayer matrix offset before palette lookup | Tiny |
| **Glyph** | Characters instead of pixels: ASCII, braille, blocks | Per-cell luminance picks a glyph from an atlas (code below) | Tiny |
| Bloom | Soft halos on everything emissive | Built-in TSL bloom node on the emissive target | Medium |
| Volumetric fog | Light you can walk through | Half-res ray march with depth upsampling, after the [r186 fog example](https://threejs.org/examples/#webgpu_postprocessing_fog) | Medium-high |
| God rays | Light shafts in Prism Cathedral and Tidal Stair | Radial blur from the light's screen position | Medium |
| Feedback trails | Motion leaves melting afterimages | Blend 85% of last frame, zoomed 0.4% and rotated 0.1° | Low |
| Thin-film iridescence | Soap-bubble colour on the Veins and the reef | `MeshPhysicalNodeMaterial` iridescence | Low |
| Ray-marched fractals | Infinite coral and sky | Mandelbulb and kaleidoscopic IFS in a bounding mesh, half-res, temporal upsample | High |
| Kaleidoscope | 6-fold mirror at screen edges or full screen | Polar UV fold in post | Tiny |
| Sky mandala | The calendar overhead | Polar SDF rings on the sky dome, rotated by night number | Low |
| Gerstner water | Tidal Stair sea | Sum of 6 Gerstner waves + fresnel + depth tint | Low |
| Caustics | Underwater light nets | Animated Voronoi projected from above | Low |
| Watcher material | A body-shaped hole of inverted static | Screen-space sample of the scene, inverted, mixed with noise | Low |
| Link transitions | Pour, fold, shatter, bloom-out, dissolve | Noise masks blending two realm renders over 0.6 s (Visions up to 2 s) | Medium, only during links |
| Memory splats | Real places dissolving into dream | Native `GaussianSplat` from [r186](https://radiancefields.com/three.js-ships-its-native-gaussian-splat-renderer-and-splat-raycasting-in-r186) (PLY, SPZ, KSPLAT, glTF), splats drifted by noise | Medium |

### Sketch: the glyph pass (replaces ASCII Magic)

```js
import * as THREE from 'three/webgpu';
import { Fn, pass, uniform, screenUV, screenSize, vec2, vec4,
         floor, fract, clamp, texture, luminance } from 'three/tsl';

const RAMP = ' .:-=+*#%@';                     // dark → bright
const atlas = makeGlyphAtlas(RAMP, 'VT323');    // one-row CanvasTexture
const cell = uniform(8);                         // glyph size in px
const count = uniform(RAMP.length);

const glyph = Fn(([scene]) => {
  const px = screenUV.mul(screenSize);
  const centre = floor(px.div(cell)).add(0.5).mul(cell).div(screenSize);
  const src = scene.sample(centre);
  const idx = floor(clamp(luminance(src.rgb), 0, 0.999).mul(count));
  const local = fract(px.div(cell));
  const mask = texture(atlas, vec2(idx.add(local.x).div(count), local.y)).r;
  return vec4(src.rgb.mul(mask).mul(1.4), 1);
});

const pipeline = new THREE.RenderPipeline(renderer);
pipeline.outputNode = glyph(pass(scene, camera).getTextureNode());
```

Swap `RAMP` for braille (⠀⠁⠃⠇⠏⠟⠿⡿⣿) or blocks (░▒▓█) to get ASCII Magic's other looks. Animate `cell` for a breathing effect.

### Sketch: PS1 vertex snap

```js
import { Fn, vec4, floor, positionLocal, modelViewMatrix,
         cameraProjectionMatrix, uniform } from 'three/tsl';

const grid = uniform(new THREE.Vector2(240, 135));
material.vertexNode = Fn(() => {
  const clip = cameraProjectionMatrix.mul(modelViewMatrix).mul(vec4(positionLocal, 1));
  const ndc = clip.xy.div(clip.w);
  const snapped = floor(ndc.mul(grid).add(0.5)).div(grid);
  return vec4(snapped.mul(clip.w), clip.z, clip.w);
})();
```

Both sketches are starting points; TSL is still changing release to release, so pin the Three.js version and check them against its docs.

### Rules for smoothness

- Every animated value goes through a spring or ease, never a linear jump.
- Frame-time spikes are worse than a lower average: compile all shaders at load with `renderer.compileAsync` and pre-warm both realms before a link.
- Ray-marched and fog effects render at half resolution and upsample temporally.

## No engine: pure code and libraries

DMT runs on no game engine: no Unity, Unreal, Godot, GameMaker, PlayCanvas or Babylon.js, and no engine editor or visual scripting. It's our own TypeScript code on top of web platform APIs, plus a handful of small libraries that each do one narrow job. The game loop, scenes, input, split-screen, saves and every system are code we write. Three.js only draws and Rapier only collides.

### Who does what

| Job | Our code | Library or platform API |
| --- | --- | --- |
| Game loop, fixed 60 Hz timestep | All of it (sketch below) | `requestAnimationFrame` |
| Rendering, shaders, post-processing | TSL materials, passes, transitions, split-screen compositor | three (WebGPURenderer, TSL, RenderPipeline) |
| Realm loading and streaming | Realm loader, asset cache, pre-warming | three's `GLTFLoader`, `KTX2Loader`, Meshopt decoder |
| Physics and link contacts | Character feel, link triggers | Rapier (WebAssembly) |
| Entities | All systems: Lanternfolk, Watcher, events, Laws | bitECS for data storage only |
| Particles and boids | All simulation code | TSL compute shaders |
| Input for 4 players | Device mapping, rebinding, join and leave | Gamepad, Keyboard and Pointer Lock APIs |
| Audio and generative music | Scores, mixer, pane panning | Web Audio API + Tone.js |
| Procedural generation | Seeds, wave-function-collapse layouts, event deck, Laws | `simplex-noise`, our PCG32 |
| Saves, Afterimage, dream codes | Formats and logic | IndexedDB via `idb-keyval` |
| Menus, journal, Atlas | Plain DOM + CSS overlays, no UI framework | Fullscreen API |
| Dev tools | In-game editor (F1), debug views | Tweakpane, Three.js Inspector |
| Desktop and Steam | Window, settings, achievements glue | Electron + `steamworks.js` |

### The game loop

```ts
const STEP = 1 / 60;
let acc = 0, last = performance.now() / 1000;

function frame(ms: number) {
  const now = ms / 1000;
  acc += Math.min(now - last, 0.25);      // no spiral of death after a stall
  last = now;
  input.poll();                            // 4 gamepads + keyboard/mouse
  while (acc >= STEP) {
    director.tick(STEP);                   // seeded: Afterimage stays exact
    physics.step(STEP);                    // Rapier
    for (const s of systems) s.tick(STEP); // bitECS systems
    acc -= STEP;
  }
  const alpha = acc / STEP;                // interpolate between sim states
  for (const pane of panes) pane.render(alpha);
  audio.update();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

### Levels without an editor

- Realm layouts are TypeScript and JSON: lists of kit pieces, rules for the wave-function-collapse solver, landmark and quiet-place positions. They're diffable and reviewable like any other code.
- An in-game dev editor (F1) places anchors and props and writes the JSON back. It's about 1,000 lines of our own code, not an engine.
- Blender is optional, only for fixing downloaded meshes. Nothing in the game depends on a .blend file.

### Platform tech used

WebGPU (with a WebGL 2 fallback), WebAssembly, Web Audio, the Gamepad API, Pointer Lock, Fullscreen, IndexedDB, and Web Workers so level generation and texture decoding run off the main thread.

### Rules

1. **Open formats only:** glTF/GLB, KTX2, PNG, Opus/Ogg, WAV, JSON. No engine-specific assets, which also rules out Fab content made for Unreal.
2. **Thin wrappers:** three and Rapier sit behind small interfaces (`Renderer`, `Physics`), so either could be swapped.
3. **Permissive licences:** three, Tone.js, Tweakpane, `simplex-noise`, glTF-Transform, Electron and `steamworks.js` are MIT; Rapier and `idb-keyval` are Apache-2.0; bitECS is MPL-2.0 (fine for commercial use, as long as changes to its own files are shared). Check each when you pin versions.
4. **Six runtime dependencies:** three, Rapier, bitECS, Tone.js, `simplex-noise`, `idb-keyval`. Everything else is a build or dev tool.

## Tech stack & architecture

Build it as a TypeScript web game with no engine, on Three.js and WebGPU, then wrap it for desktop. Every tool below is free and open source. The web build doubles as a free itch.io demo; the desktop build ships on Steam.

| Layer | Choice | Why |
| --- | --- | --- |
| Language and build | TypeScript + Vite | Fast hot reload while tuning shaders |
| Renderer | `three` pinned at r186 or later, `three/webgpu` + `three/tsl` | WebGPURenderer, TSL, `RenderPipeline`, native Gaussian splats; falls back to WebGL 2 |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | Kinematic character controller; contact events trigger links |
| Entities | bitECS | Data-oriented, thousands of lanterns and moths stay cheap |
| GPU simulation | TSL compute shaders | Drifters, moths, book-fish boids |
| Audio | Web Audio API + Tone.js | Generative music and spatial sound |
| Noise and seeds | `simplex-noise` + a PCG32 random generator | Deterministic nights for Afterimage |
| Asset pipeline | glTF-Transform CLI: Meshopt geometry, KTX2/Basis textures | 5 to 10× smaller downloads |
| Saves | IndexedDB (`idb-keyval`) | 365 nights of seeds, link logs and journal photos |
| Live tuning | Tweakpane + the Three.js Inspector | Sliders for every shader uniform; frame timeline |
| Mesh fixes | Blender (free, optional) | Optional, only for fixing downloaded meshes; layouts are JSON from the F1 editor |
| Desktop shell | Electron + `steamworks.js` | Bundles Chromium, so WebGPU behaves the same on every PC |
| Testing | Vitest + Playwright screenshots of fixed seeds | Catches visual regressions per realm |
| Split-screen | Renderer viewport and scissor per pane, one RenderPipeline per pane | Each dreamer gets a full first-person view; panes resize on springs |
| Couch play online | Steam Remote Play Together | Friends join local co-op over the internet with no netcode to write |
| Replay content | Dream Laws, events and Diary fragments as JSON data files | New content ships without code changes; easy to mod |

### Runtime architecture

&#91;embedded content: runtime architecture · the Director as hub\]

The **Dream Director** is the only system that knows what night it is. Physics reports contacts, entities report events, and the Director decides where the link goes. It then tells the Realm Builder, render pipeline and audio engine what to show and play. Each wake, it writes the seed and link log so the night can be replayed exactly.

### Project layout

```
dmt/
  src/
    core/         game loop, events, assets, input, panes, saves
    director/     night seed, timer, resonance, link table
    realms/       one folder per realm: layout.json, kit pieces, WFC rules, palettes
    entities/     lanternfolk, watcher, drifters, boids
    render/       materials (lo-fi, film, paper, glyph), passes, transitions
    audio/        generative scores, SFX banks, spatial mixer
    journal/      photo picker, poem tables, save/load
  assets/         raw downloads, licence file per pack
  tools/          import pipeline (decimate, quantise, compress) + F1 level editor
```

### Building it with Claude Code

You already have Claude Code, which can write all of the engine-free code above; your Blender connection is handy for mesh fixes only. Two community skills, `webgpu-threejs-tsl` and the Three.js skill pack, teach agents current TSL and WebGPU APIs. Use them, and have agents work one realm or one shader per task.

## Asset sourcing

Build about 80% of the game from CC0 packs, which need no credit, and use CC-BY only where it buys something unique, crediting it automatically. Because every import is downsampled and palette-quantised, packs from different makers end up looking like one game. Licence details below come from [Cinevva's free 3D model guide](https://app.cinevva.com/guides/free-3d-model-sites) and [its free audio guide](https://app.cinevva.com/guides/free-sound-effects-music); confirm each pack's licence when you download it.

### Sources, by licence

| Source | Licence | Use it for |
| --- | --- | --- |
| [Kenney](https://kenney.nl) | CC0 | Furniture, city, nature and train kits for anchor layouts; UI and audio packs |
| [Quaternius](https://quaternius.com) | CC0 | Rigged Universal Base Characters and animation library (Sleeper, Watcher, Lantern Woman); stylised nature |
| [KayKit](https://kaylousberg.itch.io) | CC0 (most packs) | Modular props and furniture "Bits" packs for the Lantern Flat and Market |
| [Poly Haven](https://polyhaven.com) | CC0 | HDRIs for image-based light; paper, plaster, marble and water textures. Has a keyless public API |
| [ambientCG](https://ambientcg.com) | CC0 | Paper, fabric, tile and ground materials |
| [PolygonalMind](https://github.com/PolygonalMind) | CC0 (open-source releases) | Stylised rigged avatars for background figures |
| [Smithsonian Open Access 3D](https://3d.si.edu) | CC0 on marked models only | Statues and artefacts for Prism Cathedral and Night School; decimate heavily |
| [NASA 3D Resources](https://science.nasa.gov) | NASA media guidelines | Planets and asteroids as Cloud Orchard "fruit"; never imply NASA endorsement |
| [Poly Pizza](https://poly.pizza) | Mostly CC-BY, some CC0 | Whimsical low-poly props; credit each creator |
| [Sketchfab](https://sketchfab.com) | Per model | Filter to CC0 or CC-BY only; skip NC models |
| [OpenGameArt](https://opengameart.org) | Per asset | Textures and audio; avoid GPL and share-alike assets |
| [Sonniss GDC bundles](https://sonniss.com/gameaudiogdc) | Royalty-free, no credit | Studio-grade ambiences and SFX; the 2026 bundle is 7 GB+ |
| [Freesound](https://freesound.org) | Per sound, filter to CC0 | Specific textures: wind chimes, paper, tape hiss |
| Google Fonts | SIL Open Font License | Cormorant Garamond, VT323 |

**Avoid entirely:** CC-BY-NC, "Editorial use" models, GPL assets, anything from AI 3D tools without a commercial plan, and anything that resembles LSD's actual art.

### Specialised fetches per realm

| Realm | What to fetch | Where | Search terms |
| --- | --- | --- | --- |
| Lantern Flat | Furniture, futon, lamps, window frame | Kenney Furniture Kit, KayKit furniture | "bed", "lamp", "shelf" |
| Cloud Orchard | Stylised trees; small planet meshes | Quaternius nature packs; NASA 3D | "stylized tree", "moon", "asteroid" |
| Lantern Market | Stalls, crates, awnings, lanterns | KayKit, Kenney, Poly Pizza | "market stall", "lantern", "awning" |
| Prism Cathedral | Columns, arches, statues; marble texture | Smithsonian 3D (CC0 only), Poly Haven | "statue", "column", "marble" |
| Evening Suburb | Houses, bikes, vending machines, power lines | Kenney City Kit, Poly Pizza | "house", "bicycle", "vending machine" |
| Tidal Stair | Stone stair module; sea-dusk HDRI | Kenney, Poly Haven HDRIs | "stairs", "dusk sea" |
| Origami Metro | Train, buildings; paper fibre texture | Kenney Train and City Kits, ambientCG | "train", "building", "paper" |
| Drowned Library | Bookshelves, books, desk | KayKit, Poly Pizza | "bookshelf", "book" |
| Static Field | Old CRT TVs, grass | Poly Pizza, Sketchfab (CC0) | "crt tv", "television" |
| Fractal Reef | Nothing: all ray-marched in shaders | (code) | — |
| The Veins | Organic tile texture for displacement | ambientCG | "organic", "leather", "pearl" |
| Glyph Desert | Dune terrain only; the glyph shader does the rest | Generated heightmap | — |
| Night School | Desks, lockers, doors, piano | Kenney, KayKit, Poly Pizza | "desk", "locker", "piano" |
| Whale of Light | One whale model to turn into a point cloud | Sketchfab, filtered to CC0 | "whale" |
| Memory splats | Your own scans of real rooms and streets | A free phone scanning app that exports PLY or SPZ | — |

The [Cinevva asset search](https://app.cinevva.com/guides/free-3d-model-sites) queries Kenney, Quaternius, Poly Haven, Sketchfab and others from one box, with the licence shown on each result.

### Import pipeline (`tools/import`)

1. Download into `assets/raw/<pack>/` with the pack's licence file beside it.
2. Weld and simplify with glTF-Transform to a triangle budget: props 300 to 3,000, hero pieces up to 8,000.
3. Resize textures to 128 px, quantise to the realm's 32-colour palette, keep a 512 px emissive map where needed.
4. Compress: Meshopt geometry, KTX2/Basis textures.
5. Tag each mesh for linking (water, light, paper, glass, flesh, glyph, machine) in a sidecar JSON.
6. Write the licence and credit line into `assets/manifest.json`. The credits screen is generated from it, so no CC-BY credit can be forgotten.

## Audio design

The music is generative and follows the Resonance chart, so a night sounds the way it looks. Everything is built in Tone.js from free sample sources, then granular-stretched and re-pitched until it belongs to this game.

### Score by mood

| Quadrant | Mode | Tempo | Instruments |
| --- | --- | --- | --- |
| Halo | Lydian, major pentatonic | 60 to 72 bpm, rubato | Felt piano, glass harmonica, breathy choir pads |
| Bloom | Mixolydian | 100 to 116 bpm | Gamelan-like mallets, marimba arpeggios, hand drums |
| Hush | Dorian, sparse | Pulse-free drones | Bowed metal, tape-hiss pads, single far bell |
| Undertow | Phrygian, whole-tone | 84 to 96 bpm, off-kilter | Detuned FM bass, reversed swells, heartbeat percussion |

The engine blends between quadrants continuously: mode, tempo and instrument volumes move with the chart position, so there are no track changes.

### Layers

1. **Bed:** a drone tuned to the realm's root note.
2. **Motif:** 3 to 5 note fragments from the realm's theme, placed by chance.
3. **World:** spatial sounds from entities and objects, with HRTF panning.
4. **Touch:** every link has a sound family: paper crinkles, water pours, glass chimes, light swells, glyph clicks.
5. **The telephone:** the same two-note ring in every realm, the game's one fixed sound.

### Special cues

- **Watcher:** as he nears, a low-pass filter closes over the whole mix. At contact there's 1 s of silence, then the wake chime.
- **Visions:** the music drops to the bed and a unique cue plays on top.
- **Quiet places:** standing still 20 s fades in a 30 s ambient piece.
- **Waking:** the mix pulls back to the Lantern Flat's room tone, a ticking clock and distant traffic.

### Sources and process

- Field recordings and SFX: the Sonniss GDC bundles (royalty-free, no credit), Freesound filtered to CC0, Kenney audio packs.
- Turn raw recordings into instruments with granular stretching, convolution with impulse responses from the same bundles, and pitch-shifting to the realm's key.
- Write all melodies from scratch; don't imitate LSD's soundtrack.
- Mix to about −16 LUFS integrated, with a headphone recommendation on the title screen.

## Procedural generation

Every night is generated from one seed, so it's endlessly varied yet exactly replayable. Hand-built anchor layouts keep each realm recognisable; generation only dresses and mutates them.

### Seeds

- **Save seed:** chosen once per save file.
- **Night seed** = hash(save seed, night number).
- **Realm-visit seed** = hash(night seed, link index). Every random choice inside a visit draws from it.
- All randomness goes through one PCG32 generator, never `Math.random`, and the simulation runs on a fixed 60 Hz step. Without both, Afterimage replays would drift.

### What a realm visit generates

1. Pick the texture mood (by chart quadrant), era (by night number) and palette mood (weighted by Resonance), then roll the night's Dream Laws and draw from the event deck (see Replayability).
2. Load the anchor layout (landmark, paths, quiet place).
3. Scatter dressing with Poisson-disk sampling and per-realm rule tables ("lanterns cluster near stalls", "books avoid open water").
4. Spawn entities: Lanternfolk count rises with Bright, moths and drifters with Still.
5. Roll the Watcher: chance per visit = 2% + 6% × depth (0 at full Bright, 1 at full Deep), at most once per night.
6. Roll a Vision: 1 in 40 links, 1 in 25 from night 100.

### Choosing the next realm

When you link, each candidate realm gets a weight, and the visit seed picks one:

```latex
w_r = T_{\text{tag},r} \cdot A_r(\text{resonance}) \cdot N_r \cdot [r \neq \text{current}]
```

Here T is the tag table (what you touched leads where), A is how well the realm fits your current chart position, and N is a novelty boost of 1.5 for realms you haven't seen in 5 nights.

### Peripheral mutation

The dream changes when you're not looking. Objects outside the camera frustum for more than 8 s may swap places, change texture or quietly disappear, at most 3 per minute. It's cheap to build and makes the world feel like a dream rather than a level.

### Variety budget

12 realms × 4 texture moods × 4 eras × 4 palettes is 768 looks, before run-seed layouts, night palettes, Dream Laws, events and dressing. No two nights match unless you replay one with Afterimage or a dream code.

## Replayability: no two runs alike

A run is one 365-night cycle. Each new run rewires the world, each night rolls fresh laws, events, textures and music on top, and long-term collections and secrets give reasons to start again. Variety has three layers: the run, the night, and the visit.

### What a new run reshuffles

The run seed is rolled when a cycle begins.

- **The link graph:** the tag table is re-rolled within limits, so touching water might lead to the library this run and the reef the next.
- **Realm layouts:** apart from its landmark and quiet place, each realm is rebuilt from modular kit pieces by a wave-function-collapse solver. Paths, rooms and heights change every run.
- **Texture ownership:** texture sets shuffle between realms. The reef may wear the library's textures this time.
- **The window view:** the impossible city outside the Lantern Flat's window changes, and so does the realm it hints at.
- **The Watcher's habits:** his speed, his routes and the realms he haunts most.
- **The lead motif:** one of the five motifs (kite, train, lantern woman, telephone, moons) carries this run's story arc and changes over the year.
- **Visions and Diary order:** which nights they fall on.
- **The Lantern Flat:** small souvenirs from your nights pile up in the room (a paper crane, a ticket, a shell) and stay for the run.

### What every night rolls

**Dream Laws:** 0 to 2 rule modifiers per night, more on Deep nights, about 40 in total. They're never announced; you notice them, and the journal names them in the morning.

| Dream Law | Effect |
| --- | --- |
| Feather | Gravity at 30%; floating lasts far longer |
| Mirror | The world is flipped left to right |
| Glass night | Every material turns to glass |
| Giant / Tiny | You're 10× or 0.1× normal size |
| Hush | No music, only footsteps and wind |
| Backwards | Animations and clocks run in reverse |
| Watchers | Every figure turns to face you, then away |
| Glyph night | The glyph shader covers every realm |
| Long night | The timer runs twice as long |
| Sticky | Links need 2 s of contact |
| Paper night | Everything is made of paper and folds when touched |
| Indoor rain | It rains inside, never outside |

**The event deck:** 200+ micro-events, drawn per realm visit. Draws are weighted by realm, Resonance, night number and that morning's Diary keywords. Each event has a 30-night cooldown, and rarity runs common, uncommon, rare, and 1 in 500. Examples:

- A bus stops, opens its doors, waits, and leaves; nobody gets off.
- Every street lamp slowly turns to follow you.
- A Lanternfolk hands you a lantern; it comes with you through links until you put it down.
- A huge smiling sun sets in five seconds.
- The Watcher waits at a bus stop and never boards.
- It snows paper umbrellas.

**Texture drift:** besides the quadrant's texture mood, each realm ages through 4 eras, one step about every 90 nights: fresh, worn, overgrown, abstract. Night 300 looks unlike night 30.

**Night palette:** within its quadrant LUT, each night rotates hue by up to ±25° and generates an accent colour from OKLCH harmonies.

**The night's theme:** each night composes a 4 to 6 note motif from its seed, in the realm's mode. It recurs across every realm that night, and the journal page can play it back.

### Long-term reasons to replay

| Feature | What it is |
| --- | --- |
| **Dream Atlas** | A collection book of realms × eras × moods, events, laws, Visions and entities: about 600 entries, shown as silhouettes until found |
| **The chart secret** | Painting a particular picture with your chart dots over many nights opens a hidden 13th realm. Inspired by LSD's own chart secret; our shape is original and never hinted in-game |
| **Daily Dream** | One seed per real-world day, the same for everyone. Share journal pages; no leaderboards |
| **Dream codes** | Every night has a 12-character code (seed + laws). Enter one at the Lantern Flat to dream it again or share it; it doesn't advance the night count |
| **Cycles** | After night 365 a new run begins with a new run seed. Each cycle adds a set of realm variants and allows one more Dream Law per night |
| **Endless mode** | Unlocked after the first cycle: no night count, no Threshold, just dreaming |
| **Real-world calendar** | A third moon on real full-moon nights; longer timers on the winter solstice; a lantern party in the market on a night you choose |
| **Co-op content** | Chorus rooms and about 30 events that need 2 to 4 dreamers |
| **Community Dream Diary** | Free updates add Diary fragments and events written from player-submitted dreams |
| **Achievements** | About 50, rewarding curiosity, not grind: "Watch the bus leave", "Fall asleep inside a dream" |

## Performance budget

Target a locked 60 fps, about 16.6 ms per frame, on integrated laptop graphics. The low-res scene pass is what makes this realistic: geometry renders at 480 × 270 whatever the screen size, and only the light layer runs at full resolution. These numbers are targets to measure against, not measurements.

### Hardware targets

| Tier | Example hardware | Output | Preset |
| --- | --- | --- | --- |
| Minimum | Recent integrated laptop GPU (Intel Iris Xe class, Apple M1) | 1080p, 60 fps | Low: fog and ray-marching at quarter resolution |
| Handheld | Steam Deck | 800p, 60 fps | Low, fewer particles |
| Recommended | Mid-range desktop GPU (GTX 1660 / RX 6600 class) | 1440p, 60 fps | High |
| High end | Recent desktop GPU | 4K, 60 to 120 fps | High + full-res fog |

### GPU time per frame, minimum tier

| Pass | Budget (ms) |
| --- | --- |
| Low-res scene pass | 3.0 |
| Ray-marched fractals (reef and sky only) | 3.0 |
| Volumetric fog, half resolution | 2.0 |
| Link transition (only while linking) | 2.0 |
| Bloom | 1.0 |
| Compute particles and boids | 1.0 |
| Feedback trails, LUT grade, lens | 0.6 |
| Upscale, quantise, glyph pass | 0.6 |
| Headroom | 3.4 |
| **Total** | **16.6** |

### Split-screen presets

| Players | Light layer per pane | Fog and ray-marching | Particles | Target |
| --- | --- | --- | --- | --- |
| 1 | Full resolution | Half resolution | 100% | 60 fps, minimum tier |
| 2 | 75% | Half resolution | 75% | 60 fps, minimum tier |
| 3 to 4 | 50% | Quarter resolution; ray-marching in one pane only | 50% | 60 fps recommended tier; 30 to 60 fps minimum tier |

### Other limits

- Draw calls under 300 per frame, using instancing and `BatchedMesh`.
- Under 400,000 visible triangles; the low-res buffer hides the savings.
- Memory under 1.5 GB; each realm streams in under 25 MB compressed.
- Web demo download under 150 MB.
- No frame over 25 ms during links: pre-warm the next realm while the transition mask is still mostly covering the screen.

### Quality settings

Resolution scale of the light layer, fog and ray-march quality, particle count, feedback trails on or off, gentle mode, and an FPS cap at 30, 60 or unlocked.

## Roadmap

Prove the look first. The 8-week vertical slice exists to answer one question: does a link feel magical at 60 fps on a laptop? Everything after it is content and systems on a proven base. The schedule assumes one full-time developer working with Claude Code; part-time roughly doubles it. Co-op and the replay systems add about 6 weeks, for about 54 in total.

&#91;embedded content: roadmap · 4 phases, 4 gates, about 54 weeks\]

If the slice misses its gate, cut scope rather than slipping: drop to 8 realms before dropping the frame rate.

### Vertical slice contents

- Lantern Flat, Prism Cathedral (the light showcase) and Glyph Desert (the ASCII showcase)
- Contact linking with two transition shaders: bloom-out and glyph dissolve
- The full lo-fi body / hi-fi light pipeline, with a Resonance LUT blend driven by a debug slider
- Lanternfolk with procedural motion, and 2-player split-screen from day one (adding co-op later costs far more)
- A 2-minute capture for feedback on the look

### First week

- [ ] Scaffold Vite + TypeScript + three (pinned) with WebGPURenderer and a WebGL fallback
- [ ] Low-res scene pass and nearest upscale; vertex snap material on a Kenney test room
- [ ] Glyph pass from the sketch in Shaders, with the cell size on a Tweakpane slider
- [ ] Rapier character controller with springs on look and movement, for two players on two viewports
- [ ] Contact trigger that swaps between two test scenes with a crossfade
- [ ] Download Kenney Furniture Kit, Poly Haven marble and one dusk HDRI into `assets/raw` with licence files

## Risks, naming & legal

The biggest non-technical risk is the title. A drug name on a store page can limit advertising and console certification, and it shapes how people judge the game before they play it. Keep the game free of any drug imagery, lean on the in-world backronym (Dream Memory Transit), and decide early whether to keep "DMT". This isn't legal advice; for the trademark and store questions, check with a lawyer.

| Risk | Mitigation |
| --- | --- |
| Drug-name title limits ads, store featuring or console release | Pitch it as "Dream Memory Transit"; check Steam, itch.io and ad-platform content rules before the store page goes up; keep a fallback name ready |
| Trademark clash with "Dream Simulator" or similar titles | Search EUIPO and DPMA (you're in Germany) and USPTO before announcing |
| Too close to LSD: Dream Emulator | Mechanics like linking are fine to build on, but art, music, characters and names stay 100% original (see Characters) |
| Photosensitive seizures | 3-flash-per-second cap, clamped luminance changes, gentle mode, warning screen; run the trailer through a flash-analysis tool |
| Motion sickness | Smoothed camera, roll cap, field-of-view slider, gentle mode turns off screen breathing |
| TSL and WebGPU APIs change between releases | Pin the Three.js version; upgrade on purpose with the migration guide; keep the WebGL 2 fallback tested |
| Asset licence mistakes | Licence file per pack; manifest-generated credits; CC0 first; no NC, GPL or editorial assets |
| Sketchfab's future after its sale to KitBash in August 2026 | Download and archive any Sketchfab models and their licence info now |
| Fab "Fab Standard" terms for a non-Unreal game | Skip Fab assets unless their terms clearly allow use in a Three.js game |
| Scope: 12 realms for one developer | Gate after the slice; cut to 8 realms before cutting quality |
| Four first-person panes miss 60 fps on low-end PCs | 480 × 270 lo-fi pass per pane; the 4-player preset; an optional 30 fps cap for 4 players on minimum hardware |
| Co-op multiplies testing: 4 dreamers in 4 realms | Bots driving 4 virtual gamepads through fixed seeds every night; split-screen built into the slice from day one |
| Replay systems swell the scope | Laws and events are data; launch with 40 laws and 200 events, then add more in free updates |

### Sources

The first two pages were read in full; the rest were consulted through search excerpts.

- [ASCII Magic app](https://www.ascii-magic.com/app)
- [Cinevva: free 3D model sites](https://app.cinevva.com/guides/free-3d-model-sites)
- [Cinevva: free sound effects and music for games (2026)](https://app.cinevva.com/guides/free-sound-effects-music)
- [Hardcore Gaming 101: LSD: Dream Emulator](https://www.hardcoregaming101.net/lsd-dream-emulator/)
- [Dream Emulator wiki: Dream](https://dreamemulator.fandom.com/wiki/Dream)
- [PSX Datacenter: LSD Dream Emulator](https://psxdatacenter.com/games/J/L/SLPS-01556.html)
- [Osamu Sato Wiki: LSD: Dream Emulator](https://compu-lsd.com/w/LSD:_Dream_Emulator)
- [Cinevva: Three.js r183 and RenderPipeline](https://app.cinevva.com/news/2026-03-18-threejs-r183-render-pipeline)
- [Radiance Fields: three.js r186 ships native Gaussian splats](https://radiancefields.com/three.js-ships-its-native-gaussian-splat-renderer-and-splat-raycasting-in-r186)
- [Three.js example: WebGPU volumetric fog](https://threejs.org/examples/#webgpu_postprocessing_fog)
- [Three.js manual: WebGPURenderer](https://threejs.org/manual/pages/webgpurenderer)
- [Utsubo: WebGPU + Three.js migration guide (2026)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- [Bedroom Producers Blog: Sonniss GDC 2026 bundle](https://bedroomproducersblog.com/2026/03/16/sonniss-gdc-2026-bundle/)
- [webgpu-threejs-tsl agent skill](https://cdn.jsdelivr.net/gh/dgreenheck/webgpu-claude-skill@main/README.md)
