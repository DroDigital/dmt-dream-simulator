import type { RealmId, Tag, Quadrant } from './types';

export interface RealmMeta {
  id: RealmId;
  name: string;
  mood: string;
  /** home position on the Resonance chart */
  home: { x: number; y: number };
  tags: Tag[];
  /** breath timer in minutes when the night starts here */
  minutes: number;
  /** mundane realms keep the hi-fi light layer flat and plain */
  mundane: boolean;
  indoor: boolean;
  root: number; // midi root note for the bed drone
  landmark: string;
  quiet: string;
}

export const REALMS: Record<RealmId, RealmMeta> = {
  flat: { id: 'flat', name: 'Lantern Flat', mood: 'Hub', home: { x: 0, y: 0 }, tags: [], minutes: 0, mundane: true, indoor: true, root: 57, landmark: 'the window', quiet: 'the futon' },
  orchard: { id: 'orchard', name: 'Cloud Orchard', mood: 'Halo', home: { x: -2.5, y: 2.5 }, tags: ['light', 'glass'], minutes: 7, mundane: false, indoor: false, root: 64, landmark: 'the ringed tree', quiet: 'a swing' },
  market: { id: 'market', name: 'Lantern Market', mood: 'Bloom', home: { x: 2.5, y: 2.5 }, tags: ['light', 'paper'], minutes: 10, mundane: false, indoor: false, root: 62, landmark: 'the market gate', quiet: 'a closed stall' },
  cathedral: { id: 'cathedral', name: 'Prism Cathedral', mood: 'Halo', home: { x: -1.5, y: 3.5 }, tags: ['glass', 'light'], minutes: 6, mundane: false, indoor: true, root: 60, landmark: 'the rose window', quiet: 'a pew' },
  suburb: { id: 'suburb', name: 'Evening Suburb', mood: 'Bloom', home: { x: 1.5, y: 1.5 }, tags: ['paper', 'machine'], minutes: 5, mundane: true, indoor: false, root: 65, landmark: 'the water tower', quiet: 'the bus stop bench' },
  stair: { id: 'stair', name: 'Tidal Stair', mood: 'Centre', home: { x: 0, y: 0 }, tags: ['water'], minutes: 6, mundane: false, indoor: false, root: 55, landmark: 'the two moons', quiet: 'the landing' },
  metro: { id: 'metro', name: 'Origami Metro', mood: 'Alive', home: { x: 3.5, y: 0 }, tags: ['paper', 'machine'], minutes: 5, mundane: false, indoor: false, root: 67, landmark: 'the folding tower', quiet: 'the platform bench' },
  library: { id: 'library', name: 'Drowned Library', mood: 'Hush', home: { x: -2.5, y: -2 }, tags: ['water', 'paper'], minutes: 6, mundane: false, indoor: true, root: 53, landmark: 'the reading lamp', quiet: 'the reading desk' },
  static: { id: 'static', name: 'Static Field', mood: 'Hush', home: { x: -1.5, y: -3 }, tags: ['machine', 'glyph'], minutes: 5, mundane: true, indoor: false, root: 50, landmark: 'the antenna', quiet: 'the armchair' },
  reef: { id: 'reef', name: 'Fractal Reef', mood: 'Undertow', home: { x: 2.5, y: -2.5 }, tags: ['flesh', 'water'], minutes: 7, mundane: false, indoor: false, root: 52, landmark: 'the spiral', quiet: 'the pearl' },
  veins: { id: 'veins', name: 'The Veins', mood: 'Undertow', home: { x: 1.5, y: -3.5 }, tags: ['flesh', 'machine'], minutes: 4, mundane: false, indoor: true, root: 48, landmark: 'the heart organ', quiet: 'a warm alcove' },
  desert: { id: 'desert', name: 'Glyph Desert', mood: 'Deep', home: { x: 0, y: -4 }, tags: ['glyph'], minutes: 8, mundane: false, indoor: false, root: 51, landmark: 'the letter obelisk', quiet: 'a dune crest' },
  school: { id: 'school', name: 'Night School', mood: 'Still', home: { x: -3.5, y: 0 }, tags: ['water', 'light', 'paper', 'glass', 'flesh', 'glyph', 'machine'], minutes: 3, mundane: true, indoor: true, root: 58, landmark: 'the clock', quiet: 'the music room' },
  threshold: { id: 'threshold', name: 'The Threshold', mood: '—', home: { x: 0, y: 0 }, tags: [], minutes: 4, mundane: false, indoor: false, root: 60, landmark: 'the doorway', quiet: '' },
  orrery: { id: 'orrery', name: 'The Orrery', mood: 'Secret', home: { x: 0, y: 0 }, tags: ['glass', 'light', 'machine'], minutes: 6, mundane: false, indoor: false, root: 63, landmark: 'the brass sun', quiet: 'the rim' },
  chorus: { id: 'chorus', name: 'Chorus Room', mood: 'Together', home: { x: 0, y: 0 }, tags: ['light', 'glass'], minutes: 4, mundane: false, indoor: true, root: 60, landmark: 'the round hall', quiet: 'the centre' },
};

export const QUADRANT_START: Record<Quadrant, RealmId> = {
  halo: 'orchard',
  bloom: 'market',
  hush: 'library',
  undertow: 'reef',
};
