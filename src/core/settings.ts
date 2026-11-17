export interface PlayerProfile {
  name: string;
  dreamer: 0 | 1 | 2 | 3; // Moth, Kite, Bell, Crane
  sensitivity: number;
  invertY: boolean;
  fov: number;
  gentle: boolean;
}

export interface Settings {
  gentle: boolean; // photosensitivity mode
  breathing: boolean; // FOV breathing + screen breathing
  roll: boolean;
  instantLinks: boolean; // original-style hard fade
  colourBlind: boolean;
  trails: boolean;
  quality: 'low' | 'high';
  fpsCap: 30 | 60 | 0;
  lightScale: number; // 0.5..1 resolution of light layer
  bubblePanes: boolean;
  volume: number;
  music: number;
  renderer: 'auto' | 'webgl';
  lanternPartyMonth: number; // 1..12
  lanternPartyDay: number;
  shortNights: boolean; // dev/testing: nights last 45 s
  glyphRamp: 0 | 1 | 2;
  seenWarning: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  gentle: false,
  breathing: true,
  roll: true,
  instantLinks: false,
  colourBlind: false,
  trails: true,
  quality: 'high',
  fpsCap: 60,
  lightScale: 1,
  bubblePanes: false,
  volume: 0.8,
  music: 0.7,
  renderer: 'auto',
  lanternPartyMonth: 8,
  lanternPartyDay: 15,
  shortNights: false,
  glyphRamp: 0,
  seenWarning: false,
};

export const DREAMERS = ['Moth', 'Kite', 'Bell', 'Crane'] as const;

export function defaultProfile(i: number): PlayerProfile {
  return { name: DREAMERS[i], dreamer: i as 0 | 1 | 2 | 3, sensitivity: 1, invertY: false, fov: 75, gentle: false };
}
