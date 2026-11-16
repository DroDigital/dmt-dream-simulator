import { get, set, del } from 'idb-keyval';
import type { RealmId, Resonance } from '../data/types';
import type { ChartDot } from '../director/resonance';
import { DEFAULT_SETTINGS, defaultProfile, type Settings, type PlayerProfile } from './settings';

export interface LinkLogEntry { t: number; slot: number; from: RealmId; obj: string; to: RealmId; idx: number }

export interface NightRecord {
  night: number;
  cycle: number;
  seed: number;
  laws: string[];
  start: RealmId;
  links: LinkLogEntry[];
  dots: { slot: number; x: number; y: number; colour: string }[];
  group: Resonance;
  poems: string[][];
  polaroids: string[];
  diary: number;
  realms: RealmId[];
  events: string[];
  visions: string[];
  erased: boolean;
  mode: 'normal' | 'afterimage' | 'code' | 'daily';
  code: string;
  date: string;
  duration: number;
}

export interface SaveData {
  version: 1;
  saveSeed: number;
  runSeed: number;
  cycle: number;
  night: number; // the next night to dream (1..365)
  endless: boolean;
  resonance: Resonance; // group dot that sets tomorrow's start
  divergent: Resonance[] | null;
  dots: ChartDot[];
  nights: NightRecord[];
  lastSeenNight: Partial<Record<RealmId, number>>;
  seenRealms: RealmId[];
  memory: string[];
  atlas: string[];
  achievements: string[];
  souvenirs: string[];
  eventLastSeen: Record<string, number>;
  quietHeard: RealmId[];
  lawsSeen: string[];
  visionsSeen: string[];
  profiles: PlayerProfile[];
  settings: Settings;
  lastDiary: number;
  dailyDone: string;
  stats: Record<string, number>;
}

const KEY = 'dmt-save-v1';

export function freshSave(seed = (Math.random() * 2 ** 32) >>> 0): SaveData {
  return {
    version: 1, saveSeed: seed, runSeed: (seed ^ 0x9e3779b9) >>> 0, cycle: 1, night: 1, endless: false,
    resonance: { x: 0, y: 0 }, divergent: null, dots: [], nights: [], lastSeenNight: {}, seenRealms: [], memory: [],
    atlas: [], achievements: [], souvenirs: [], eventLastSeen: {}, quietHeard: [], lawsSeen: [], visionsSeen: [],
    profiles: [0, 1, 2, 3].map(defaultProfile), settings: { ...DEFAULT_SETTINGS }, lastDiary: -1, dailyDone: '', stats: {},
  };
}

export async function loadSave(): Promise<SaveData> {
  try {
    const s = (await get(KEY)) as SaveData | undefined;
    if (s && s.version === 1) {
      const f = freshSave(s.saveSeed);
      return { ...f, ...s, settings: { ...DEFAULT_SETTINGS, ...s.settings }, profiles: s.profiles?.length === 4 ? s.profiles : f.profiles };
    }
  } catch (e) {
    console.warn('save load failed', e);
  }
  return freshSave();
}

let pending: Promise<void> | null = null;
export function writeSave(s: SaveData): Promise<void> {
  const p = (pending ?? Promise.resolve()).then(() => set(KEY, s)).catch((e) => console.warn('save failed', e));
  pending = p;
  return p;
}
export async function wipeSave() { await del(KEY); }
