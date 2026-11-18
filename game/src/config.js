// Solmar Bay — shared tuning, city layout and mission script.
// All names, places and gangs here are invented for this game.
export const CITY = {
  half: 260,          // city extends -260..260 on x and z
  block: 52,          // block size; roads run between blocks
  roadWidth: 12,
  seaZ: 300,          // beach / water start (south edge, +z)
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 12,
  health: 100,
  startCash: 150,
};

export const WANTED = {
  decayPerSec: 0.045,   // stars drift down when quiet
  maxStars: 5,
  copCarSpeed: 26,
  copFootSpeed: 7.5,
};

export const CAR_COLORS = [
  0xd43a2f, 0x2f7fd4, 0xe8c832, 0x37b24d, 0x8a5fc0,
  0xe8e8e8, 0x222831, 0xe07b2a, 0x18b5a6, 0xc23a7d,
];

export const CAR_NAMES = [
  'Comet GT', 'Sunset Cruiser', 'Bay Runner', 'Pelican Van', 'Coral Coupe',
  'Harbor Taxi', 'Palm Sedan', 'Dune Buggy', 'Marina Pickup', 'Neon Hatch',
];

// Mission script: each mission is a chain of steps. A step is complete when the
// player reaches its marker (drive/walk) or clears its target list.
export const MISSIONS = [
  {
    id: 'wheels',
    name: '1 — First Wheels',
    brief: 'Borrow a car, any car. Drive it to Rico’s garage on Marina Row.',
    reward: 300,
    steps: [
      { kind: 'getcar', text: 'Steal a car — walk up to one and press E.' },
      { kind: 'goto', pos: [150, 0, -150], radius: 14,
        text: 'Drive to Rico’s garage (yellow marker) on Marina Row.' },
    ],
  },
  {
    id: 'pickup',
    name: '2 — Beachfront Pickup',
    brief: 'A package is waiting on the south beach. Grab it, then drop it at the old warehouse on Dockside — and expect the PD to notice.',
    reward: 600,
    steps: [
      { kind: 'goto', pos: [-180, 0, 240], radius: 12,
        text: 'Pick up the package on the south beach.' },
      { kind: 'goto', pos: [-210, 0, -190], radius: 14,
        text: 'Deliver the package to the Dockside warehouse. Watch for police!' },
    ],
    onStartWanted: 2,
  },
  {
    id: 'docks',
    name: '3 — Dockside Showdown',
    brief: 'The Coral Kings are muscling in on the docks. Clear them out — five of them — then meet Rico at the pier to end it.',
    reward: 1200,
    steps: [
      { kind: 'clear', pos: [-210, 0, -190], count: 5, radius: 30,
        text: 'Take out 5 Coral Kings at the docks. Click to shoot, F to punch.' },
      { kind: 'goto', pos: [-230, 0, 60], radius: 12,
        text: 'Meet Rico at the north pier. Job done.' },
    ],
  },
  {
    id: 'finale',
    name: '4 — Bay Heist',
    brief: 'One last job: grab the Coral Kings’ cash stash at the marina tower, then lose the heat and reach the safehouse.',
    reward: 2500,
    steps: [
      { kind: 'goto', pos: [210, 0, 210], radius: 12,
        text: 'Grab the stash at the marina tower.' },
      { kind: 'escape', text: 'Lose the cops — stay out of sight until the stars fade.' },
      { kind: 'goto', pos: [40, 0, -40], radius: 12,
        text: 'Reach the safehouse in the old town.' },
    ],
    onStartWanted: 3,
  },
];

export const SAVE_KEY = 'solmar-bay-save-v1';
