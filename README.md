# Grok Blocks 🦓🚚

A blocky voxel-world **wildlife rescue** game for phones and desktop. You're a ranger on the case: explore five biomes, calm animals with limited tranquilizer darts, load them onto your truck and get them to a sanctuary before the poachers do.

**Play:** https://lizethbran13-cmyk.github.io/grok-blocks/

## What's in it
- **Base Camp + 5 biomes:** Golden Savanna, Deep Jungle, Snow Peaks, Mist Wetlands and Desert Canyon. Each is a deterministic voxel heightmap with its own palette, cover, roads, trails and a poacher camp.
- **18 species**, each with a temperament:
  - **chill:** walk up and dart.
  - **runner:** bolts, so chase it in the truck and cut it off.
  - **feisty:** winds up and charges. Approach downwind, sneak through cover, or send the crew to distract it.
- **Capture loop:** limited darts (restock at the camp supply crate) → LOAD the sleeping animal → drive back through the camp gate → UNLOAD in the **Sunlands** or **Frostmarsh** sanctuary. Delivered animals live there for good.
- **Truck:** gas, brake/reverse, steering and handbrake. Take the SEAT in the back and the crew drives while you dart. Ramming an animal spooks it and costs a star.
- **Poachers** on foot and in jeeps:
  - They flash a "!" before chasing, so you get a warning.
  - Getting caught confiscates the truck's cargo and sends you back to camp. Delivered animals and case progress are kept.
  - Use flares or the crew's siren to scare them off.
  - If you take too long, they go after the case animals. Bump their jeep to free a caged animal.
- **8 cases** with a tracker, a yellow objective arrow and 1–3 stars, plus free roam:
  - First Rescue (tutorial)
  - Stripe Chase
  - Relocate the Rhino
  - Jungle Hush
  - Night Rescue
  - Wetland Watch
  - Stop the Convoy
  - The Big Herd
- **Points** buy upgrades: darts, range, softer dose, engine, cargo bed, flares.
- **Fair play:**
  - Assist mode
  - No game over; a bust sends you back to camp with your progress kept
  - Radio back to camp from the pause menu
  - A tutorial
- **Polish:**
  - Procedural music and sound effects with mute
  - An optional day/night cycle
  - Minimap and wind indicator
  - Field guide
- **Co-op (2–3 players):** the host runs the game, friends join with a 5-letter room code (PeerJS), and everyone gets a name tag. Friends can ride in the truck and dart from the back. If someone leaves, the game keeps going.
- **Touch controls** built for iPhone Safari in portrait and landscape (buttons ≥ 58 px). On a keyboard: WASD/arrows to move or steer, Space for gas/dart, E to use.

Built with three.js. All art is generated in code from blocks, with no external assets.
