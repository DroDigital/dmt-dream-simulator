import type { RealmId } from './types';

// The event deck: 200+ micro-events, drawn per realm visit. Funny, tender,
// eerie, pointless. Each is a behaviour plus parameters, so the deck is data.

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 1, uncommon: 0.4, rare: 0.12, mythic: 1 / 500 };

export type Behaviour =
  | 'vehicle' | 'followLamps' | 'gift' | 'bigSun' | 'watcherWaits' | 'rainOf' | 'giantWalker'
  | 'procession' | 'swarm' | 'glowObject' | 'sound' | 'shadow' | 'floatUp' | 'resize' | 'colourShift'
  | 'door' | 'screensOn' | 'phoneRing' | 'kite' | 'skyTrain' | 'lanternWoman' | 'moonBlink'
  | 'footsteps' | 'starer' | 'spin' | 'balloon' | 'airFish' | 'clocks' | 'flowers' | 'faceCloud'
  | 'skyStairs' | 'hole' | 'chorusBell' | 'dance';

export type Mood = 'funny' | 'tender' | 'eerie' | 'pointless' | 'wonder';

export interface DreamEvent {
  id: string;
  text: string; // how the journal names it
  behaviour: Behaviour;
  params: Record<string, any>;
  rarity: Rarity;
  mood: Mood;
  realms?: RealmId[];
  keywords: string[];
  minNight?: number;
  coop?: number; // needs at least this many dreamers
}

const OUT: DreamEvent[] = [];
let n = 0;
function ev(text: string, behaviour: Behaviour, params: Record<string, any>, mood: Mood, keywords: string[], extra: Partial<DreamEvent> = {}) {
  OUT.push({ id: `e${(n++).toString().padStart(3, '0')}`, text, behaviour, params, rarity: 'common', mood, keywords, ...extra });
}

// ── hand-written events ───────────────────────────────────────────────────
ev('A bus stopped, opened its doors, waited, and left. Nobody got off.', 'vehicle', { kind: 'bus', colour: '#e8c46a' }, 'pointless', ['bus', 'waiting', 'street'], { realms: ['suburb', 'metro', 'school', 'static'] });
ev('Every street lamp slowly turned to follow me.', 'followLamps', {}, 'eerie', ['lamp', 'light', 'watched'], { rarity: 'uncommon' });
ev('A Lanternfolk handed me a lantern. I carried it a long way.', 'gift', { item: 'lantern' }, 'tender', ['lantern', 'gift', 'light']);
ev('A huge smiling sun set in five seconds.', 'bigSun', { face: true }, 'funny', ['sun', 'face', 'evening'], { rarity: 'uncommon' });
ev('The tall man waited at a bus stop and never boarded.', 'watcherWaits', {}, 'eerie', ['watcher', 'bus', 'waiting'], { rarity: 'rare', realms: ['suburb', 'static', 'metro'] });
ev('It snowed paper umbrellas.', 'rainOf', { item: 'umbrella', colour: '#ff6f91' }, 'wonder', ['umbrella', 'paper', 'snow'], { rarity: 'uncommon' });
ev('A giant in a raincoat walked along the horizon without looking down.', 'giantWalker', { colour: '#e8d070' }, 'eerie', ['giant', 'horizon', 'rain'], { rarity: 'uncommon' });
ev('A line of small paper people marched past, very busy.', 'procession', { kind: 'paper', count: 9 }, 'funny', ['paper', 'people', 'parade']);
ev('Paper planes flew over in a perfect V.', 'swarm', { item: 'plane', count: 14 }, 'wonder', ['paper', 'plane', 'birds']);
ev('A vending machine hummed a lullaby.', 'sound', { kind: 'lullaby', at: 'machine' }, 'tender', ['machine', 'song', 'lullaby'], { realms: ['suburb', 'school', 'static'] });
ev('A shadow passed over the ground. There was nothing in the sky.', 'shadow', {}, 'eerie', ['shadow', 'sky', 'nothing']);
ev('All the small things floated up and away.', 'floatUp', {}, 'wonder', ['float', 'sky', 'leaving']);
ev('A door stood by itself in the open, slightly ajar.', 'door', {}, 'eerie', ['door', 'open', 'alone'], { rarity: 'uncommon' });
ev('Every screen turned on at once, showing the same eye.', 'screensOn', { image: 'eye' }, 'eerie', ['screen', 'eye', 'watched'], { realms: ['static', 'school', 'suburb'], rarity: 'uncommon' });
ev('A telephone rang somewhere close. It was for me.', 'phoneRing', {}, 'eerie', ['telephone', 'call', 'voice']);
ev('The red kite drifted past, just out of reach.', 'kite', {}, 'tender', ['kite', 'red', 'reach']);
ev('The night train passed through the sky, windows full of other places.', 'skyTrain', {}, 'wonder', ['train', 'sky', 'windows'], { rarity: 'uncommon' });
ev('The lantern woman stood in a doorway, facing away.', 'lanternWoman', {}, 'eerie', ['lantern', 'woman', 'door']);
ev('Both moons blinked.', 'moonBlink', {}, 'eerie', ['moon', 'eye', 'blink'], { rarity: 'rare' });
ev('Footsteps followed me, stopping when I stopped.', 'footsteps', {}, 'eerie', ['footsteps', 'behind', 'follow']);
ev('Someone stood very far away, just standing.', 'starer', {}, 'eerie', ['figure', 'far', 'standing']);
ev('The whole world slowly turned on its side, then back.', 'spin', {}, 'wonder', ['turn', 'world', 'dizzy'], { rarity: 'rare' });
ev('A single blue balloon rose past me.', 'balloon', { colour: '#5fa8ff' }, 'tender', ['balloon', 'blue', 'rising']);
ev('Fish swam through the air between the houses.', 'airFish', { count: 12 }, 'wonder', ['fish', 'air', 'swim']);
ev('Every clock struck thirteen.', 'clocks', { strikes: 13 }, 'eerie', ['clock', 'time', 'thirteen'], { rarity: 'uncommon' });
ev('Flowers opened wherever I walked.', 'flowers', {}, 'tender', ['flower', 'walk', 'spring']);
ev('A cloud with a kind face drifted over.', 'faceCloud', {}, 'funny', ['cloud', 'face', 'kind']);
ev('A staircase unfolded into the sky.', 'skyStairs', {}, 'wonder', ['stairs', 'sky', 'up'], { rarity: 'uncommon' });
ev('A hole opened in the ground, perfectly round.', 'hole', {}, 'eerie', ['hole', 'down', 'round'], { rarity: 'uncommon' });
ev('A great bell rang, and only rang when we were all beside it.', 'chorusBell', {}, 'wonder', ['bell', 'together', 'ring'], { coop: 2, rarity: 'uncommon' });
ev('The houses danced, very slightly, when they thought no one was looking.', 'dance', { what: 'buildings' }, 'funny', ['house', 'dance', 'secret'], { realms: ['suburb', 'metro', 'market'] });
ev('A small boat floated down the street.', 'vehicle', { kind: 'boat', colour: '#f2f2f2' }, 'pointless', ['boat', 'street', 'water']);
ev('An ice-cream van played a tune nobody knew.', 'vehicle', { kind: 'van', colour: '#ffd1e6', tune: true }, 'funny', ['ice-cream', 'tune', 'van'], { realms: ['suburb', 'metro', 'static'] });
ev('The lights in every window went out one by one.', 'colourShift', { to: 'dark' }, 'eerie', ['window', 'dark', 'one-by-one'], { realms: ['suburb', 'metro', 'school'] });
ev('A piano played in another room, then stopped mid-note.', 'sound', { kind: 'piano' }, 'eerie', ['piano', 'room', 'stop']);
ev('A dog barked twice, very politely.', 'sound', { kind: 'bark' }, 'funny', ['dog', 'polite']);
ev('Laundry on a line waved at me.', 'dance', { what: 'laundry' }, 'funny', ['laundry', 'wave', 'line']);
ev('All the Lanternfolk sat down at once.', 'dance', { what: 'lanternfolk-sit' }, 'pointless', ['lanternfolk', 'sit']);
ev('The moths spelled a word in the air, then forgot it.', 'swarm', { item: 'moth', count: 40, word: true }, 'wonder', ['moth', 'word', 'forget'], { rarity: 'uncommon' });
ev('A bicycle rode by with no one on it.', 'vehicle', { kind: 'bicycle', colour: '#c0392b' }, 'eerie', ['bicycle', 'empty', 'ride']);
ev('A teacup the size of a house sat in the distance.', 'resize', { item: 'teacup', scale: 30 }, 'funny', ['teacup', 'giant', 'tea'], { rarity: 'uncommon' });
ev('Everything near me shrank to half its size, then forgot to grow back.', 'resize', { item: 'near', scale: 0.5 }, 'funny', ['small', 'shrink'], { rarity: 'uncommon' });
ev('The colours drained to the left and pooled there.', 'colourShift', { to: 'left' }, 'pointless', ['colour', 'pool']);
ev('A whale sang somewhere under the floor.', 'sound', { kind: 'whale' }, 'wonder', ['whale', 'song', 'under']);
ev('A crowd applauded from nowhere.', 'sound', { kind: 'applause' }, 'funny', ['applause', 'crowd']);
ev('A wind chime played my name.', 'sound', { kind: 'chime' }, 'tender', ['chime', 'name', 'wind']);
ev('A train of lanterns floated out over the sea.', 'swarm', { item: 'lantern', count: 30 }, 'tender', ['lantern', 'sea', 'leaving'], { realms: ['stair', 'market', 'orchard'] });
ev('A tree walked a few steps and then pretended it had not.', 'dance', { what: 'trees' }, 'funny', ['tree', 'walk', 'pretend'], { realms: ['orchard', 'suburb', 'static'] });
ev('The ground was warm, like something asleep.', 'sound', { kind: 'breath' }, 'eerie', ['ground', 'warm', 'asleep'], { realms: ['veins', 'reef', 'desert'] });
ev('A procession of televisions walked into the sea.', 'procession', { kind: 'tv', count: 7 }, 'pointless', ['tv', 'sea', 'parade'], { rarity: 'rare' });
ev('A parade of cats in paper hats.', 'procession', { kind: 'cat', count: 8 }, 'funny', ['cat', 'hat', 'parade'], { rarity: 'uncommon' });
ev('Someone left a cake on the floor, still warm.', 'glowObject', { item: 'cake' }, 'pointless', ['cake', 'warm', 'left']);
ev('A suitcase sat in the middle of everything, humming.', 'glowObject', { item: 'suitcase' }, 'eerie', ['suitcase', 'hum', 'travel']);
ev('A lit candle floated at eye height.', 'glowObject', { item: 'candle' }, 'tender', ['candle', 'float', 'light']);
ev('A mailbox overflowed with letters addressed to nobody.', 'rainOf', { item: 'letter', colour: '#f7f1e0' }, 'tender', ['letter', 'mail', 'nobody']);
ev('An escalator went up into a cloud.', 'skyStairs', { escalator: true }, 'wonder', ['escalator', 'cloud', 'up'], { rarity: 'rare' });
ev('A great moth sat on the moon.', 'moonBlink', { moth: true }, 'wonder', ['moth', 'moon'], { rarity: 'rare' });
ev('The sky unzipped a little and showed a second sky.', 'colourShift', { to: 'sky' }, 'wonder', ['sky', 'zip', 'second'], { rarity: 'rare' });
ev('A smiling sun rose and set, rose and set, very fast.', 'bigSun', { face: true, repeat: 3 }, 'funny', ['sun', 'fast', 'face'], { rarity: 'rare' });
ev('Everyone was looking at the same spot on the ground.', 'starer', { many: true }, 'eerie', ['figure', 'ground', 'looking'], { rarity: 'uncommon' });
ev('We held a parade of two, then three, then four.', 'procession', { kind: 'dreamers', count: 4 }, 'tender', ['together', 'parade'], { coop: 2 });
ev('Our shadows held hands even when we did not.', 'shadow', { hands: true }, 'tender', ['shadow', 'hands', 'together'], { coop: 2, rarity: 'uncommon' });
ev('The bell rang only when all four of us touched it.', 'chorusBell', { need: 4 }, 'wonder', ['bell', 'four', 'together'], { coop: 4, rarity: 'rare' });

// ── generated families (still data: template × subject) ──────────────────
const RAIN: [string, string, string, Mood, Rarity][] = [
  ['petals', 'petal', '#ffc0d8', 'tender', 'common'], ['feathers', 'feather', '#ffffff', 'tender', 'common'],
  ['coins', 'coin', '#ffd36a', 'funny', 'uncommon'], ['keys', 'key', '#c9c9c9', 'eerie', 'uncommon'],
  ['tickets', 'ticket', '#f2e4b0', 'pointless', 'common'], ['snowflakes', 'snow', '#ffffff', 'wonder', 'common'],
  ['leaves', 'leaf', '#e08a3a', 'tender', 'common'], ['stars', 'star', '#fff4a0', 'wonder', 'uncommon'],
  ['fish', 'fish', '#7ad0ff', 'funny', 'uncommon'], ['paper cranes', 'crane', '#ff8fb0', 'wonder', 'uncommon'],
  ['buttons', 'button', '#ff6f6f', 'pointless', 'common'], ['letters of the alphabet', 'glyph', '#a0ffd0', 'wonder', 'common'],
  ['photographs', 'photo', '#f0f0f0', 'eerie', 'uncommon'], ['spoons', 'spoon', '#d0d0e0', 'funny', 'common'],
  ['light bulbs', 'bulb', '#fff0a0', 'pointless', 'common'], ['tiny chairs', 'chair', '#c08a5a', 'funny', 'uncommon'],
  ['marbles', 'marble', '#80c0ff', 'pointless', 'common'], ['matches', 'match', '#ff9a50', 'eerie', 'common'],
  ['teeth of a comb', 'comb', '#e0d0b0', 'eerie', 'rare'], ['moons', 'moon', '#fff8e0', 'wonder', 'rare'],
];
for (const [plural, item, colour, mood, rarity] of RAIN) {
  ev(`It rained ${plural}.`, 'rainOf', { item, colour }, mood, [item, 'rain', 'falling'], { rarity });
}

const SWARMS: [string, string, number, Mood][] = [
  ['birds made of folded paper', 'crane', 16, 'wonder'], ['moths', 'moth', 60, 'tender'], ['bats with lantern eyes', 'bat', 20, 'eerie'],
  ['umbrellas', 'umbrella', 10, 'funny'], ['clocks', 'clock', 8, 'eerie'], ['envelopes', 'letter', 18, 'tender'],
  ['jellyfish of light', 'drifter', 12, 'wonder'], ['hats', 'hat', 9, 'funny'], ['keys with wings', 'key', 14, 'pointless'],
  ['tiny trains', 'train', 6, 'funny'], ['shoes', 'shoe', 12, 'pointless'], ['books', 'book', 16, 'wonder'],
];
for (const [what, item, count, mood] of SWARMS) {
  ev(`A flock of ${what} flew over.`, 'swarm', { item, count }, mood, [item, 'flock', 'sky']);
}

const VEHICLES: [string, string, string, Mood][] = [
  ['A tram with no rails glided past.', 'tram', '#e0c060', 'pointless'], ['A hearse-black taxi slowed beside me, then went on.', 'taxi', '#1a1a1a', 'eerie'],
  ['A school bus full of balloons drove by.', 'bus', '#ffcc33', 'funny'], ['A rowing boat crossed the road, rowed by nobody.', 'boat', '#8a6a4a', 'eerie'],
  ['A delivery van delivered a single egg.', 'van', '#f0f0f0', 'funny'], ['A sleigh went by in summer.', 'sleigh', '#c0392b', 'pointless'],
  ['A carousel horse galloped past, alone.', 'horse', '#f7d6e0', 'wonder'], ['An ambulance went by very slowly, singing.', 'van', '#ffffff', 'funny'],
];
for (const [text, kind, colour, mood] of VEHICLES) ev(text, 'vehicle', { kind, colour }, mood, [kind, 'passing', 'road'], { realms: ['suburb', 'metro', 'static', 'market', 'desert'] });

const PROCESSIONS: [string, string, Mood][] = [
  ['A line of ducks crossed in front of me, very formal.', 'duck', 'funny'], ['Lanternfolk carried a sleeping lantern on their shoulders.', 'lanternfolk', 'tender'],
  ['Chairs walked in single file to somewhere important.', 'chair', 'funny'], ['A row of tall shadows walked the other way.', 'shadow', 'eerie'],
  ['Small clocks marched past, ticking in step.', 'clock', 'pointless'], ['A choir of moths passed, humming one chord.', 'moth', 'tender'],
  ['Mannequins in bathing suits strolled by.', 'mannequin', 'funny'], ['Snowmen walked slowly south.', 'snowman', 'pointless'],
  ['A family of mailboxes went for a walk.', 'mailbox', 'funny'], ['Paper lanterns walked on paper legs.', 'lantern', 'wonder'],
];
for (const [text, kind, mood] of PROCESSIONS) ev(text, 'procession', { kind, count: 6 }, mood, [kind, 'line', 'walking']);

const GLOWS: [string, string, Mood][] = [
  ['a telephone box', 'phonebox', 'eerie'], ['a red mailbox', 'mailbox', 'tender'], ['an armchair', 'armchair', 'pointless'], ['a goldfish bowl', 'bowl', 'wonder'],
  ['a pair of shoes', 'shoe', 'tender'], ['a birthday cake with no candles', 'cake', 'eerie'], ['a small television', 'tv', 'eerie'], ['a lamp post', 'lamp', 'pointless'],
  ['a bathtub full of stars', 'bathtub', 'wonder'], ['a school desk', 'desk', 'pointless'], ['a radio playing static', 'radio', 'eerie'], ['an open umbrella', 'umbrella', 'tender'],
  ['a door handle without a door', 'handle', 'eerie'], ['a jar of fireflies', 'jar', 'wonder'], ['a single slipper', 'slipper', 'pointless'], ['a typewriter typing by itself', 'typewriter', 'eerie'],
];
for (const [what, item, mood] of GLOWS) ev(`I found ${what}, glowing softly, where it should not be.`, 'glowObject', { item }, mood, [item, 'glow', 'found']);

const SOUNDS: [string, string, Mood][] = [
  ['A kettle whistled far away.', 'kettle', 'tender'], ['Somebody laughed in the next street.', 'laugh', 'eerie'], ['A music box ran down.', 'musicbox', 'tender'],
  ['A train horn, very long, very far.', 'horn', 'eerie'], ['Birds sang, but backwards.', 'birds', 'eerie'], ['A choir sang one note for a whole minute.', 'choir', 'wonder'],
  ['Rain on a tin roof, though nothing fell.', 'rain', 'pointless'], ['A school bell rang for nobody.', 'schoolbell', 'eerie'], ['A cat purred inside the walls.', 'purr', 'funny'],
  ['Wind chimes played a song I knew as a child.', 'chime', 'tender'], ['Someone called a name that was almost mine.', 'call', 'eerie'], ['Crickets, then sudden silence.', 'crickets', 'eerie'],
  ['A radio tuned itself between stations.', 'radio', 'pointless'], ['A heartbeat under the floor, slow and kind.', 'heartbeat', 'tender'], ['A gong, then another, further.', 'gong', 'wonder'],
];
for (const [text, kind, mood] of SOUNDS) ev(text, 'sound', { kind }, mood, [kind, 'sound', 'listening']);

const RESIZES: [string, string, number, Mood][] = [
  ['A spoon the size of a bridge leaned on the horizon.', 'spoon', 28, 'funny'], ['A chair taller than a church stood alone.', 'chair', 20, 'wonder'],
  ['A giant pair of glasses lay in the grass.', 'glasses', 18, 'funny'], ['A shoe the size of a house, with a door in it.', 'shoe', 22, 'funny'],
  ['A teapot as big as a hill, steaming.', 'teacup', 25, 'pointless'], ['A rubber duck the size of a ship floated by.', 'duck', 26, 'funny'],
  ['A paper crane as big as a cloud.', 'crane', 30, 'wonder'], ['A telephone the size of a tower, ringing slowly.', 'phone', 24, 'eerie'],
];
for (const [text, item, scale, mood] of RESIZES) ev(text, 'resize', { item, scale }, mood, [item, 'giant', 'scale'], { rarity: 'uncommon' });

const FLOAT_UPS: [string, Mood][] = [
  ['The puddles rose and hung in the air like windows.', 'wonder'], ['Benches lifted off the ground, then settled back.', 'pointless'],
  ['My shadow floated up and waited above me.', 'eerie'], ['Rocks floated, polite as balloons.', 'funny'], ['The books lifted off the shelves to breathe.', 'wonder'],
  ['Flowerpots rose, one by one, and did not come down.', 'tender'],
];
for (const [text, mood] of FLOAT_UPS) ev(text, 'floatUp', {}, mood, ['float', 'rise', 'air']);

const SHIFTS: [string, string, Mood][] = [
  ['Everything turned the colour of tea.', 'sepia', 'tender'], ['The world went pink for a moment.', 'pink', 'funny'], ['All the shadows turned blue.', 'blue', 'wonder'],
  ['The colours swapped places with their neighbours.', 'swap', 'pointless'], ['Everything went grey except one red thing.', 'red', 'eerie'], ['The light went green, like under leaves.', 'green', 'tender'],
];
for (const [text, to, mood] of SHIFTS) ev(text, 'colourShift', { to }, mood, ['colour', to]);

const STARERS: [string, Mood][] = [
  ['A child in a yellow coat waved from a rooftop.', 'tender'], ['A man in a rabbit mask stood at the end of the road.', 'eerie'], ['A woman held up a sign with nothing on it.', 'pointless'],
  ['Someone waved from a window that was not there before.', 'eerie'], ['A figure on the horizon copied my movements.', 'eerie'], ['An old man fed birds that were not there.', 'tender'],
  ['A figure stood in the sea up to its neck, smiling.', 'eerie'], ['Two figures on a hill danced a slow waltz.', 'tender'],
];
for (const [text, mood] of STARERS) ev(text, 'starer', {}, mood, ['figure', 'far']);

const FISH: [string, number, Mood][] = [
  ['Goldfish swam lazily around the lamps.', 8, 'wonder'], ['A school of silver fish turned all at once.', 30, 'wonder'], ['A single fish followed me like a dog.', 1, 'funny'],
  ['Eels of light slid between the buildings.', 6, 'eerie'], ['Paper fish swam upstream through the air.', 14, 'wonder'],
];
for (const [text, count, mood] of FISH) ev(text, 'airFish', { count }, mood, ['fish', 'air']);

const FLOWERS: [string, Mood][] = [
  ['Paper flowers bloomed where I stepped.', 'tender'], ['Light grew out of my footprints.', 'wonder'], ['Tiny televisions sprouted behind me.', 'funny'], ['Words grew where I walked.', 'wonder'],
];
for (const [text, mood] of FLOWERS) ev(text, 'flowers', {}, mood, ['bloom', 'footsteps']);

const CLOCKS: [string, number, Mood][] = [
  ['The clocks all struck at once, a little off.', 4, 'eerie'], ['A clock struck one, very gently.', 1, 'tender'], ['The clocks struck a hundred and stopped to rest.', 30, 'funny'],
];
for (const [text, strikes, mood] of CLOCKS) ev(text, 'clocks', { strikes }, mood, ['clock', 'time']);

const DOORS: [string, Mood][] = [
  ['A red door stood in a field, knocking from the inside.', 'eerie'], ['A blue door opened onto the same view.', 'pointless'], ['A tiny door at the foot of a wall, lit from within.', 'tender'],
  ['A revolving door, revolving with no one in it.', 'funny'], ['A door hung in the sky, too high to reach.', 'wonder'],
];
for (const [text, mood] of DOORS) ev(text, 'door', {}, mood, ['door'], { rarity: 'uncommon' });

const SKIES: [string, Behaviour, Mood][] = [
  ['A cloud shaped exactly like my house went by.', 'faceCloud', 'tender'], ['A cloud yawned.', 'faceCloud', 'funny'], ['The moons rolled their eyes.', 'moonBlink', 'funny'],
  ['The night train crossed the sky, very slowly, twice.', 'skyTrain', 'wonder'], ['A kite string came down out of the clouds.', 'kite', 'tender'], ['The sun came back for one more look.', 'bigSun', 'funny'],
  ['A huge sleeping face lay in the clouds.', 'faceCloud', 'eerie'], ['A ladder came down from a cloud.', 'skyStairs', 'wonder'],
];
for (const [text, b, mood] of SKIES) ev(text, b, {}, mood, ['sky']);

const MISC: [string, Behaviour, Record<string, any>, Mood, Rarity][] = [
  ['A glass staircase led into the floor.', 'hole', { stairs: true }, 'wonder', 'uncommon'],
  ['The telephone rang, and when I answered, I heard the sea.', 'phoneRing', { sea: true }, 'tender', 'common'],
  ['The lantern woman turned her head, just slightly.', 'lanternWoman', { turn: true }, 'eerie', 'rare'],
  ['I heard my own footsteps a few seconds late.', 'footsteps', { late: true }, 'eerie', 'common'],
  ['The lamps bowed when I passed.', 'followLamps', { bow: true }, 'funny', 'uncommon'],
  ['A Lanternfolk gave me a paper crane.', 'gift', { item: 'crane' }, 'tender', 'common'],
  ['A Lanternfolk gave me a stone that was warm.', 'gift', { item: 'stone' }, 'tender', 'uncommon'],
  ['A Lanternfolk gave me a ticket for a train that does not run.', 'gift', { item: 'ticket' }, 'pointless', 'uncommon'],
  ['The ground breathed in and out once.', 'spin', { breathe: true }, 'eerie', 'uncommon'],
  ['A giant cat walked across the horizon and sat down.', 'giantWalker', { cat: true, colour: '#f0a060' }, 'funny', 'rare'],
  ['A giant made of windows walked past, all of them lit.', 'giantWalker', { windows: true, colour: '#ffe090' }, 'wonder', 'rare'],
  ['A red balloon came back and found me again.', 'balloon', { colour: '#ff4040' }, 'tender', 'uncommon'],
  ['Hundreds of balloons rose from behind the hill.', 'balloon', { many: true, colour: '#ffb0d0' }, 'wonder', 'rare'],
  ['A whale of light swam slowly through the sky, singing.', 'skyTrain', { whale: true }, 'wonder', 'mythic'],
  ['Every object in the world folded into a paper crane and flew away, and came back.', 'floatUp', { cranes: true }, 'wonder', 'mythic'],
];
for (const [text, b, params, mood, rarity] of MISC) ev(text, b, params, mood, [b], { rarity });

export const EVENTS: DreamEvent[] = OUT;
