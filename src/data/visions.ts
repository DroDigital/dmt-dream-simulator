// Visions: rare real-time set pieces (LSD used short video clips for the same job).

export interface VisionDef { id: string; name: string; duration: number; tape?: boolean; journal: string }

export const VISIONS: VisionDef[] = [
  { id: 'whale', name: 'Whale of Light', duration: 34, journal: 'A whale of light swam through the sky, singing.' },
  { id: 'unzip', name: 'Second Sky', duration: 24, journal: 'The sky unzipped and showed a second sky.' },
  { id: 'cranes', name: 'Thousand Cranes', duration: 28, journal: 'Everything folded into paper cranes and flew away.' },
  { id: 'lanternrise', name: 'Lantern Rise', duration: 26, journal: 'Thousands of lanterns rose out of the ground.' },
  { id: 'mandala', name: 'Mandala Descends', duration: 24, journal: 'The sky mandala came down and turned around me.' },
  { id: 'trainsky', name: 'Low Train', duration: 22, journal: 'The night train circled low, all its windows lit.' },
  { id: 'prism', name: 'Prism Fall', duration: 20, journal: 'Rainbow light poured down like water.' },
  { id: 'moonseye', name: 'Moons Meet', duration: 20, journal: 'The two moons met and became one eye, and blinked.' },
  { id: 'dancehouses', name: 'House Dance', duration: 24, tape: true, journal: 'The buildings danced. It was on television, somehow.' },
  { id: 'sunface', name: 'Singing Sun', duration: 20, tape: true, journal: 'A sun with a face rose and sang one long note.' },
  { id: 'vendingchoir', name: 'Vending Choir', duration: 24, tape: true, journal: 'Vending machines floated in a circle and sang.' },
  { id: 'tvgarden', name: 'Eye Garden', duration: 24, tape: true, journal: 'Televisions bloomed everywhere, each showing an eye.' },
  { id: 'kitechase', name: 'The Kite Comes Down', duration: 24, journal: 'The red kite came down, close enough to almost touch.' },
  { id: 'bloomflowers', name: 'Giant Bloom', duration: 24, journal: 'Flowers taller than houses opened around me.' },
  { id: 'starfall', name: 'Starfall', duration: 24, journal: 'The stars fell like snow and landed as letters.' },
  { id: 'flood', name: 'Luminous Flood', duration: 28, journal: 'The world filled with glowing water to my chest, then drained.' },
  { id: 'womanturns', name: 'She Turns', duration: 20, journal: 'The lantern woman turned, and her lantern lit the whole sky.' },
  { id: 'sleeper', name: 'Giant Sleeper', duration: 24, journal: 'A sleeping face rose over the horizon, breathing.' },
  { id: 'glasscathedral', name: 'Glass Bloom', duration: 24, journal: 'Glass petals grew into a cathedral around me.' },
  { id: 'unwritten', name: 'Unwritten', duration: 20, journal: 'The world fell apart into letters and wrote itself back.' },
];
