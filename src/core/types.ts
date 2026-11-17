import type * as THREE from 'three/webgpu';
import type { Tag, RealmId, Resonance, Quadrant } from '../data/types';
import type { LawEffects } from '../data/laws';
import type { DreamEvent } from '../data/events';
import type { PushReason } from '../director/resonance';
import type { PCG32 } from './rng';

export interface DreamerView {
  slot: number;
  position: THREE.Vector3; // feet
  eye: THREE.Vector3;
  yaw: number;
  velocity: THREE.Vector3;
  colour: string;
  dreamer: number;
  realmKey: string;
  holdingHands: number | null;
  carrying: string | null;
  stillTime: number;
  awake: boolean;
}

export interface GameHooks {
  readonly night: number;
  readonly time: number;
  readonly coopCount: number;
  readonly gentle: boolean;
  push(slot: number | 'all', reason: PushReason): void;
  sfx(name: string, pos?: THREE.Vector3, realmKey?: string, gain?: number): void;
  dreamersIn(realmKey: string): DreamerView[];
  wake(slot: number, reason: 'watcher' | 'timer' | 'nested'): void;
  atlas(key: string): void;
  achieve(id: string): void;
  eventSeen(e: DreamEvent): void;
  giveItem(slot: number, item: string): void;
  ringPhone(realmKey: string, on: boolean): void;
  musicDuck(amount: number, realmKey: string): void;
}

export interface RealmContext {
  id: RealmId;
  key: string; // instance key
  seed: number;
  rng: PCG32;
  night: number;
  linkIndex: number;
  era: number;
  textureMood: number;
  quadrant: Quadrant;
  palette: string[];
  accent: string;
  laws: LawEffects;
  deep: boolean;
  coop: number;
  memory: Set<string>;
  events: DreamEvent[];
  resonance: Resonance;
  watcher: boolean;
  watcherSpeed: number;
  realLife: { fullMoon: boolean; solstice: boolean; lanternParty: boolean };
  chorusOk: boolean;
  /** run-level reshuffles */
  textureOwner: RealmId;
  leadMotif: string;
  afterimage: boolean;
}

export interface LinkSpecial {
  type: 'futon' | 'door' | 'phone' | 'deep' | 'threshold' | 'kite' | 'nested' | 'up' | 'interact' | 'none' | 'realm';
  realm?: RealmId;
  interact?: string;
}

export type { Tag };
