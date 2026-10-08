/* Grok Blocks - world data: biomes, species, cases, upgrades */
(function () {
'use strict';
const B = window.GB = window.GB || {};
B.BIOMES = {
  camp:    { id: 'camp',    name: 'Base Camp',      sky: 0x87c8f0, fog: 0xc8e4f4, fogN: 0.008, ground: 0x8d9a55, sun: 0xfff2c2, amb: 0x9bb4c8, accent: 0xf0c24b },
  savanna: { id: 'savanna', name: 'Golden Savanna', sky: 0xf2c98a, fog: 0xf0d7a4, fogN: 0.010, ground: 0xc9a24a, sun: 0xffe08a, amb: 0xd8b878, accent: 0xe07a2f },
  jungle:  { id: 'jungle',  name: 'Deep Jungle',    sky: 0x6fbf7a, fog: 0x2f6b3a, fogN: 0.016, ground: 0x3d7a3a, sun: 0xd6f5c2, amb: 0x4a7a52, accent: 0x1f8a4c },
  snow:    { id: 'snow',    name: 'Snow Peaks',     sky: 0xc9def2, fog: 0xe6f0f8, fogN: 0.011, ground: 0xeef4f8, sun: 0xffffff, amb: 0xb9cfe0, accent: 0x7eb6e0 },
  wet:     { id: 'wet',     name: 'Mist Wetlands',  sky: 0x9ec9c2, fog: 0xb7ddd4, fogN: 0.014, ground: 0x6a8f62, sun: 0xfff6d8, amb: 0x8aafa6, accent: 0x3aa0a0 },
  desert:  { id: 'desert',  name: 'Desert Canyon',  sky: 0xf6c98a, fog: 0xf0c48a, fogN: 0.009, ground: 0xd9a15a, sun: 0xffe2a0, amb: 0xe0b888, accent: 0xc45a2a }
};
B.SPECIES = {
  zebra:   { id: 'zebra',   name: 'Zebra',         emoji: '\uD83E\uDD93', biome: 'savanna', temp: 'runner', size: 1.05, color: 0xf4f4f4, color2: 0x222222, pts: 120, calm: 1.0 },
  giraffe: { id: 'giraffe', name: 'Giraffe',       emoji: '\uD83E\uDD92', biome: 'savanna', temp: 'chill',  size: 1.7,  color: 0xf0c24b, color2: 0xc48a2a, pts: 160, calm: 0.8 },
  lion:    { id: 'lion',    name: 'Lion',          emoji: '\uD83E\uDD81', biome: 'savanna', temp: 'feisty', size: 1.2,  color: 0xd9922b, color2: 0x8a4b12, pts: 220, calm: 1.6 },
  elephant:{ id: 'elephant',name: 'Elephant',      emoji: '\uD83D\uDC18', biome: 'savanna', temp: 'chill',  size: 1.8,  color: 0x9aa3ad, color2: 0x6d7680, pts: 260, calm: 1.4 },
  gorilla: { id: 'gorilla', name: 'Gorilla',       emoji: '\uD83E\uDD8D', biome: 'jungle',  temp: 'feisty', size: 1.35, color: 0x3a3a3a, color2: 0x1c1c1c, pts: 240, calm: 1.7 },
  parrot:  { id: 'parrot',  name: 'Parrot',        emoji: '\uD83E\uDD9C', biome: 'jungle',  temp: 'runner', size: 0.55, color: 0x2fbf4a, color2: 0xe23b3b, pts: 100, calm: 0.7, fly: true },
  rhino:   { id: 'rhino',   name: 'Rhino',         emoji: '\uD83E\uDD8F', biome: 'savanna', temp: 'feisty', size: 1.6,  color: 0x8d8a84, color2: 0x5c5a56, pts: 280, calm: 1.8 },
  croc:    { id: 'croc',    name: 'Crocodile',     emoji: '\uD83D\uDC0A', biome: 'wet',     temp: 'feisty', size: 1.5,  color: 0x3e7a3a, color2: 0x234a22, pts: 200, calm: 1.5 },
  flamingo:{ id: 'flamingo',name: 'Flamingo',      emoji: '\uD83E\uDDA9', biome: 'wet',     temp: 'runner', size: 0.9,  color: 0xff7aa2, color2: 0xf2c2d0, pts: 110, calm: 0.7 },
  leopard: { id: 'leopard', name: 'Snow Leopard',  emoji: '\uD83D\uDC06', biome: 'snow',    temp: 'runner', size: 1.0,  color: 0xe8eef2, color2: 0x8aa0b0, pts: 260, calm: 1.3 },
  fox:     { id: 'fox',     name: 'Fennec Fox',    emoji: '\uD83E\uDD8A', biome: 'desert',  temp: 'chill',  size: 0.6,  color: 0xf2c48a, color2: 0xe8e2d4, pts: 90,  calm: 0.6 },
  panda:   { id: 'panda',   name: 'Red Panda',     emoji: '\uD83D\uDC3E', biome: 'snow',    temp: 'chill',  size: 0.65, color: 0xc8502a, color2: 0x2a1a14, pts: 120, calm: 0.7 },
  ibex:    { id: 'ibex',    name: 'Ibex',          emoji: '\uD83D\uDC10', biome: 'snow',    temp: 'feisty', size: 1.0,  color: 0x9a8268, color2: 0x5a4a38, pts: 170, calm: 1.3 },
  tapir:   { id: 'tapir',   name: 'Tapir',         emoji: '\uD83D\uDC17', biome: 'jungle',  temp: 'chill',  size: 1.0,  color: 0x2a2a30, color2: 0xe8e8e8, pts: 130, calm: 0.9 },
  okapi:   { id: 'okapi',   name: 'Okapi',         emoji: '\uD83E\uDD8C', biome: 'jungle',  temp: 'runner', size: 1.1,  color: 0x5a2a2a, color2: 0xf2f2f2, pts: 190, calm: 1.1 },
  capy:    { id: 'capy',    name: 'Capybara',      emoji: '\uD83E\uDDAB', biome: 'wet',     temp: 'chill',  size: 0.8,  color: 0x9a6a3a, color2: 0x6a4a2a, pts: 100, calm: 0.7 },
  oryx:    { id: 'oryx',    name: 'Oryx',          emoji: '\uD83E\uDD8C', biome: 'desert',  temp: 'runner', size: 1.1,  color: 0xeee6d8, color2: 0x2a2a2a, pts: 170, calm: 1.1 },
  camel:   { id: 'camel',   name: 'Camel',         emoji: '\uD83D\uDC2A', biome: 'desert',  temp: 'chill',  size: 1.4,  color: 0xd2a15a, color2: 0xa8783a, pts: 150, calm: 1.0 }
};
B.CASES = [
  { id: 'c1', name: 'First Rescue', biome: 'savanna', night: false, tut: true,
    brief: 'A calm giraffe is waiting near the acacia grove. Dart it, load the truck, and deliver it to the sanctuary.',
    goals: [{ kind: 'rescue', species: 'giraffe', n: 1 }] },
  { id: 'c2', name: 'Stripe Chase', biome: 'savanna', night: false,
    brief: 'A zebra bolts the moment it sees you. Chase it in the truck with your crew and herd it, don\u2019t ram it.',
    goals: [{ kind: 'rescue', species: 'zebra', n: 1 }] },
  { id: 'c3', name: 'Relocate the Rhino', biome: 'savanna', night: false,
    brief: 'The rhino is feisty. Stay low, let your crew distract it, then dart it from a safe distance.',
    goals: [{ kind: 'rescue', species: 'rhino', n: 1 }, { kind: 'rescue', species: 'lion', n: 1 }] },
  { id: 'c4', name: 'Jungle Hush', biome: 'jungle', night: false,
    brief: 'The gorilla charges if you rush in. Crouch, distract, dart. The parrot will try to fly off \u2014 chase it.',
    goals: [{ kind: 'rescue', species: 'gorilla', n: 1 }, { kind: 'rescue', species: 'parrot', n: 1 }] },
  { id: 'c5', name: 'Night Rescue', biome: 'snow', night: true,
    brief: 'A snow leopard hunts the peaks after dark. It runs. Cut it off with the truck before the poachers do.',
    goals: [{ kind: 'rescue', species: 'leopard', n: 1 }] },
  { id: 'c6', name: 'Wetland Watch', biome: 'wet', night: false,
    brief: 'Flamingos scatter and the crocodile snaps. Rescue both and get them to the sanctuary.',
    goals: [{ kind: 'rescue', species: 'flamingo', n: 1 }, { kind: 'rescue', species: 'croc', n: 1 }] },
  { id: 'c7', name: 'Stop the Convoy', biome: 'desert', night: false,
    brief: 'Poachers already have a camel in their jeep. Intercept the jeep, free the animal, then rescue the fennec too.',
    goals: [{ kind: 'free', n: 1 }, { kind: 'rescue', species: 'fox', n: 1 }] },
  { id: 'c8', name: 'The Big Herd', biome: 'savanna', night: false,
    brief: 'Four animals, one truck, and poachers closing in. Deliver the whole herd.',
    goals: [{ kind: 'rescue', species: 'elephant', n: 1 }, { kind: 'rescue', species: 'giraffe', n: 1 }, { kind: 'rescue', species: 'zebra', n: 1 }, { kind: 'rescue', species: 'lion', n: 1 }] },
  { id: 'c9', name: 'Sky Eye', biome: 'snow', night: false,
    brief: 'Launch the DRONE and fly a recon sweep over the poacher camp so it shows on your map. Then freeze-ray the snow leopard instead of cornering it, and bring it home.',
    goals: [{ kind: 'recon', n: 1 }, { kind: 'rescue', species: 'leopard', n: 1 }] }
];
B.UPGRADES = [
  { id: 'darts', name: 'Extra Darts', desc: '+2 darts in the clip', costs: [80, 160, 280], max: 3 },
  { id: 'range', name: 'Long Barrel', desc: 'Darts fly farther and faster', costs: [100, 200], max: 2 },
  { id: 'calm', name: 'Softer Dose', desc: 'Animals calm down quicker', costs: [120, 220], max: 2 },
  { id: 'engine', name: 'Truck Engine', desc: 'Faster truck, tighter turns', costs: [150, 260, 400], max: 3 },
  { id: 'cargo', name: 'Cargo Bed', desc: '+1 animal slot in the truck', costs: [180, 320], max: 2 },
  { id: 'flare', name: 'Flare Pack', desc: '+1 flare to scare poachers', costs: [90, 170], max: 2 }
];
/* Poacher mode: cartoon contracts. Animals leave alive in crates. */
B.JOBS = [
  { id: 'j1', name: 'Easy Crate', biome: 'savanna',
    brief: 'Net a calm giraffe and sell the crate to the shady collector at your hideout. It stays alive the whole way.',
    goals: [{ kind: 'sell', species: 'giraffe', n: 1 }] },
  { id: 'j2', name: 'Stripe Job', biome: 'savanna',
    brief: 'The zebra runs. Herd it with the truck until it is tired, net it, and sell the crate.',
    goals: [{ kind: 'sell', species: 'zebra', n: 1 }] },
  { id: 'j3', name: 'Pen Raid', biome: 'camp',
    brief: 'Sneak into Sunlands Sanctuary, crouch at the pen lock, crate one animal and sell it at your hideout. Rangers are on patrol.',
    goals: [{ kind: 'raid', n: 1 }, { kind: 'sell', species: '', n: 1 }] },
  { id: 'j4', name: 'Quiet Paws', biome: 'snow',
    brief: 'A collector wants a snow leopard. Keep your heat down and dodge the ranger jeeps.',
    goals: [{ kind: 'sell', species: 'leopard', n: 1 }] },
  { id: 'j5', name: 'Wetland Order', biome: 'wet',
    brief: 'Crate a flamingo and a capybara for the van. Both go to a private ranch, alive.',
    goals: [{ kind: 'sell', species: 'flamingo', n: 1 }, { kind: 'sell', species: 'capy', n: 1 }] },
  { id: 'j6', name: 'Big Collector', biome: 'savanna',
    brief: 'A lion and an elephant, crated and sold. Rangers will be looking, so use cover when your heat climbs.',
    goals: [{ kind: 'sell', species: 'lion', n: 1 }, { kind: 'sell', species: 'elephant', n: 1 }] }
];
B.PUPGRADES = [
  { id: 'nets', name: 'Extra Nets', desc: '+2 nets in the bag', costs: [70, 140, 220], max: 3 },
  { id: 'quiet', name: 'Quiet Boots', desc: 'Rangers notice you later', costs: [90, 170], max: 2 },
  { id: 'engine', name: 'Getaway Engine', desc: 'Faster truck, tighter turns', costs: [110, 200, 320], max: 3 },
  { id: 'cargo', name: 'Extra Crates', desc: '+1 crate on the truck', costs: [100, 190], max: 2 },
  { id: 'plates', name: 'Muddy Plates', desc: 'Heat climbs slower when spotted', costs: [80, 150], max: 2 },
  { id: 'flare', name: 'Decoy Flares', desc: '+1 decoy to distract rangers', costs: [60, 120], max: 2 }
];
B.caseById = (id) => B.CASES.find((c) => c.id === id);
B.jobById = (id) => B.JOBS.find((c) => c.id === id);
B.sp = (id) => B.SPECIES[id];
})();
