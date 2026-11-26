# Brushwild

An action RPG drawn in ballpoint and coloured pencil on cream paper, played in a browser on a desktop, a phone or with a gamepad. Pick a class, grow a skill tree, chase loot through five rarities, clear dungeons, and wander as far as you like: the land is generated as you go. The world is drawn entirely by shaders, and every item and class plate is drawn in code, so the game ships no textures, models or sprite sheets.

**Play it: https://kevintngo.github.io/procedural-rpg/**

The art style is carried over from Valsera, a 2D game drawn the same way, from baked sprites to a live 3D world: one hatch slant for the whole page, visible strokes with paper showing through, shade as a second lay of a deeper pencil, light as bare paper, a sepia pen on scenery and a bold dark contour on figures, and one mustard part on every beast: the part that hurts.

![A fight under the trees](docs/fight.jpg)

| | |
| --- | --- |
| ![Hearthmere](docs/title.jpg) | ![Night: light is paper](docs/night.jpg) |
| ![The beasts](docs/zoo.jpg) | ![Other countries](docs/biomes.jpg) |

## What there is to do

- **Four classes.** The Warden fights close with sword and shield and earns Resolve from every blow given or taken. The Emberwright casts fire, frost and storm from a staff on Focus. The Strider keeps the roads with bow, daggers and traps on Breath. The Cyborg arrives at level 99 with every skill maxed and an arm cannon full of lasers, orbital strikes and a pocket singularity, all on Compute; his head is a 3D model baked into the shader. Each has its own skills, passives and key passives, and its own look (tunic, robe or armour colour, and hair, are chosen when the hero is made).
- **A skill tree.** Seven branches, from Basic down to Ultimate and the Key Passives, each opened by points spent above it. A skill has five ranks, an enhancement and a choice of two upgrades. Points come with every level up to 99; refunds cost glint later on.
- **Loot worth reading.** Common, Magic, Rare, Legendary and Unique gear across ten slots, with rolled affixes, legendary powers and named uniques. Every item has its own drawing, tooltips compare it with what you wear in exact numbers, and drops lean toward your class. Smiths salvage, enchant and sell; alchemists brew stronger tonics; a stash is shared by every hero.
- **Fights you have to move in.** Every creature has a move of its own, drawn on the ground before it lands: Sproutlings leap, Puffcaps leave spores, Bristlehogs charge down a lane, Wisps keep their distance and throw motes, Craglings slam the ground, Shellsnaps tuck in and snap out. Step out of the mark and it misses. Elites roll affixes; dungeon bosses change at half health.
- **Towns and dungeons.** Market towns sit along the roads with a waystone, smith, alchemist, warden and stash. Crypts and caves open off the road: halls to clear, a boss in the farthest room, a hoard in a quiet one.
- **Things to find.** Caches, standing stones that lend a boon for a while, beacons that mark the places around them, and waystones to travel between.
- **Work from the warden.** Bounties to cull, gather, scout, slay an elder or clear a dungeon. The Long Walk pays for every new country you set foot in.
- **Night and falling.** After dark creatures notice you from farther off and hit harder, and pay better. Falling drops part of your glint where you fell, marked on the map, until you go back for it.
- **Blows with weight.** A hit that lands holds the world still for an instant, longer for a critical hit or a kill. Arrows fly as real arrows on an arc and stick where they miss.
- **Four difficulties.** Story, Normal, Veteran and Nightmare, changeable in town.

## Run it

Needs Node 20.19 or later.

```bash
npm install
```

```bash
npm run dev
```

Then open the address it prints (`http://localhost:5173`). Add `?new` to open the new-hero screen, and `?touch` to see the phone interface on a desktop. Progress is kept in the browser's local storage; Settings › Saves exports and imports it as a file.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with module reload |
| `npm test` | Rules and save tests (Vitest) |
| `npm run typecheck` | TypeScript, strict |
| `npm run check` | Type-check and tests |
| `npm run build` | Type-check, then a release build in `dist/` |
| `npm run preview` | Serves `dist/` |

Every push to `main` is tested, built and published by GitHub Actions (`.github/workflows/deploy.yml`), which writes the build to the `gh-pages` branch that GitHub Pages serves. It can also be run by hand from the Actions tab.

## Controls

Every action can be rebound in Settings › Controls (two keys and a pad button each).

| Keyboard and mouse | Action |
| --- | --- |
| Left click | Walk, attack, talk, pick up. Hold to keep walking or attacking. |
| Right click, 1 2 3 4 | Skills |
| W A S D | Walk |
| Space | Evade |
| F | Attack the nearest creature, talk, use a door |
| R | Drink a tonic |
| Tab | Next target |
| Shift | Stand still and attack in place |
| Q / E, right drag, wheel | Turn the view, tilt it, zoom |
| I or B / C / K / J / M / V | Inventory / character / skill tree / journal / map / view |
| Alt (hold) | Show every item label; in a tooltip, the range each line can roll |
| Esc | Menu, or close what is open |

| Gamepad | Action |
| --- | --- |
| Left stick / right stick | Walk / turn the view |
| A | Attack the nearest creature, talk, use |
| X, Y, B, RB, RT | Skills |
| LT / LB | Evade / tonic |
| D-pad | Next target (right), skill tree (left), zoom (up and down) |
| Back / Start / right stick click | Inventory / menu / show every item label. Menus are driven with the stick and A. |

On a touch screen a stick appears under the left thumb, the skills sit in an arc under the right, the big button attacks the nearest creature (hold it to carry the fight on), and tapping the picture walks. Held sideways the picture fills the screen; held upright it is a strip across the top with everything else laid out below.

| | |
| --- | --- |
| ![Upright on a phone](docs/phone-upright.jpg) | ![Sideways on a phone](docs/phone-sideways.jpg) |

A new journey opens with a few first steps, each finished by doing it; they can be skipped, and the menu brings them back.

## How it is drawn

1. **World pass** — one full-screen raymarch of the terrain heightfield, every prop (trees, rocks, houses and dungeon walls are signed-distance shapes) and the sea. For every pixel it decides *what is to be drawn*: which pencil, how firmly, how much shading, and what pen marks sit on it. It runs at an internal resolution that adapts to measured GPU time.
2. **Ink pass** — finds the contours from depth steps, object silhouettes and folds.
3. **Entity pass** — each figure is a small distance-field model raymarched inside a camera-facing quad: heroes with their class kit and the gear they wear, creatures, arrows tilted along their flight. Bold contour, hatching that rides with the figure and is re-laid six times a second, poses stepped on twos.
4. **Final pass** — paper with tooth, the pencil lay in strokes, a deeper pencil for shade, pen doodles (grass tufts, ripples), the pen along the contours, then the figures on top. A hero hidden behind scenery is shown as a pen outline. The minimap is drawn here too.

Hatching is laid in *paper coordinates*, projected on the right and up axes of a held view direction, so strokes stay glued to the world while the camera moves and a fresh direction fades in once the view has turned far enough. Stroke size is chosen per depth from nested levels, so hatching is the same width near and far. There is no bloom, blur or tone mapping: nothing is lighter than the paper, night is drawn with indigo pencils, a lamp is a pool of bare paper, and distance is drawn by laying less.

The interface uses the same hand: item and class pictures are drawn on canvas by `src/ui/art.ts` in coloured-pencil hatching under a wobbling sepia pen, seeded by each item, so two swords of the same kind still differ in blade, guard and dye, with a pencil halo in the rarity's colour. Heroes and townsfolk change expression with what happens to them: a smile at rest, focus while casting, a wince when struck, joy at a level or a legendary, worry at low health.

## What is generated

Everything outside the starting town comes from the seed:

- **Terrain** — continents, hills, mountain ranges, rivers, lakes and marsh pools, roads on a wandering lattice.
- **Thirteen biomes** chosen from five slow fields (warmth, wet, enchantment, wildness, distance from home), each with its own ground pencils, stone, plants and beasts.
- **Places** at road crossings: shrines, camps with a tinker, ruins with an elder beast, farms, market towns, and dungeon doors, each with a made-up name.
- **Dungeons** — rooms and corridors on a grid, written in the same chunk format as the open world, so they are drawn by the same shaders.
- **Finds** off the roads: caches, standing stones and beacons.
- **Beasts that take after their country** — six body plans become Frost Craglings, Marsh Shellsnaps, Petal Wisps and so on; distance from town sets the level.
- **Weather and hours** — cloud cover drifts; day, dusk and night each change the pencils.

There is no edge. Land is generated chunk by chunk as it comes into view; a chunk takes about 3 ms. Creatures gain a level every 95 units. The picture is drawn in single precision, so it looks right 20 km out and starts to show stepped edges at 200 km.

## Layout

```
.github/workflows/      the deploy on every push to main
index.html              the page
public/static/          favicon, app icons, share picture, web app manifest
tools/                  the release build's shader trimming
src/
  main.ts               entry: settings, saves, the game, the interface, sound
  config.js             shared tunables (also handed to shaders as #defines)
  engine/               events, seeded RNG, input with an action map and gamepads
  core/                 maths, noise, device
  world/                terrain, biomes, props, places, finds, dungeons   (no GL; runs in Node)
  gfx/                  renderer, camera, passes, shader chunks, figure and arrow models
  game/
    content/            classes and skills, effects, statuses, items, monsters, boons, looks
    rules/              pure rules: stats, damage, items, skill tree, build compiler, inventory, loot
    state/  save/       the saved character; storage, versions, migrations
    systems/            controls, player, skills, combat, ai, spawner, loot, zones, vendors, …
    game.ts  view.ts  fx.ts
  settings/             settings, defaults, applying them
  ui/                   Preact interface: HUD, panels, skill tree, settings, screens, art
  audio/                synthesized sound and music
docs/ARCHITECTURE.md    how it fits together, and the roadmap
```

Layers point one way (`engine/core ← world ← gfx ← game ← ui/audio`), systems announce facts on a typed event bus instead of calling each other, and content carries its own shader code. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) has the details.

## Adding things

| To add | Do this |
| --- | --- |
| A class | A `ClassDef` in `src/game/content/classes/` (skills, passives, key passives, resource, start gear) and its entry in `classes/index.ts`. |
| A skill | A row in its class: a behaviour from `game/systems/behaviors.ts` plus `params`, ranks, enhancement and upgrades as effects. |
| An item base, affix, legendary power or unique | A row in `game/content/items.ts`. Its drawing comes from its slot or weapon type in `ui/art.ts`. |
| A monster | A row in `game/content/monsters.ts` and an entry in a biome's `monsters`. A new body: `registerArchetype({...})` in `gfx/archetypes/`. |
| A creature move | An entry in `game/systems/specials.ts`, named by a monster's `special`. |
| A biome | `registerBiome({...})` in `world/biomes.js`. |
| A prop | `registerProp({...})` in `world/props.js` with its shape and its pencils, then list it in a biome or a place. |
| A place | `registerSiteKind(id, build)` in `world/sites.js`. |
| A bounty kind | An entry in `KINDS` in `game/systems/bounties.ts`. |
| An effect | `registerFx(id, glsl)` in `gfx/passes/fx.js`, spawned from a recipe in `game/fx.ts`. |
| A system | A class with `update(dt)`, added to the list in `game/game.ts`. |
| A setting | A field in `settings/settings.ts`, a control in `ui/settings.tsx`, and where it applies in `settings/apply.ts`. |
| A sound | An entry in the event table in `audio/audio.js`. |

Shader code is written in `glsl`-tagged template strings; the release build trims their indentation.

## Interface and accessibility

The interface is the same paper: cream plates with a pen border, hand lettering, bars filled with pencil hatching. It is held to WCAG 2.2 AA. Measured contrast on the plate colour `#f1ebdc`:

| Part | Colour | Contrast |
| --- | --- | --- |
| Lettering | `#4a2e18` | 10.4:1 |
| Dim lettering | `#7a5f48` | 5.0:1 |
| Red / blue / green lettering | `#b3341f` / `#48608f` / `#3d7332` | 5.2 / 5.3 / 4.8:1 |
| Pen borders | `#623c1e` | 8.1:1 |
| Bar fills | | 3.3:1 or more |
| Focus ring | | 5.9:1 |

- Every control is a real button with a name for screen readers, at least 30 px square (40 px or more on a touch screen), with a blue pen ring when it has keyboard focus. Bars are meters with values; messages are announced.
- Keyboard and gamepad reach everything, including the bag, the skill tree and the settings.
- Nothing relies on colour alone: rarity is always written, bars carry icons and numbers.
- Settings cover interface and text size, a legible font (Atkinson Hyperlegible), high contrast, colour-vision palettes and a choice of warning colour, reduced motion, screen shake, hit-stop, flashes, steady pencil lines, smooth figures, captions with direction, off-screen threat arrows, mono sound, game speed, longer warnings, auto-attack, aim assist and full rebinding.

The game itself is a moving picture played with a mouse, keys, a pad or thumbs; it has not been tested with a screen reader beyond the roles above.

## Known limits

- Single player. Input flows through `player.intent` and events, the seam where a network layer would attach.
- Movement steers and slides around obstacles; there is no long-range pathfinding.
- The world is drawn out to about 108 units (`WORLD.VIEW`); a coarser second ring of terrain is the way to see farther.
- Positions are single-precision floats in shaders, so detail coarsens tens of kilometres from the start; a floating render origin would lift that.
- The touch interface is tested in desktop Chrome at phone sizes, not yet on real phones.

## License

MIT — see [LICENSE](LICENSE). The lettering uses Alegreya, Patrick Hand and Atkinson Hyperlegible (SIL Open Font License), bundled with the game through `@fontsource`.
