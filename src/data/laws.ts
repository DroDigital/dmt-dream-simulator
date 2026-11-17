// Dream Laws: 0–2 rule modifiers per night (more on Deep nights). Never
// announced; the journal names them in the morning.

export interface LawEffects {
  gravity?: number; floatLift?: number; speed?: number; mirror?: boolean; glass?: boolean;
  scale?: number; hush?: boolean; backwards?: boolean; watchersFace?: boolean; glyph?: number;
  glyphRow?: number; timer?: number; sticky?: boolean; paper?: boolean; indoorRain?: boolean;
  duskForever?: boolean; mono?: boolean; invert?: boolean; trails?: number; tape?: number;
  kaleido?: number; wobble?: number; fog?: number; bloom?: number; lanternfolk?: number;
  moths?: boolean; echo?: boolean; skyFlip?: boolean; moonSwap?: boolean; empty?: boolean;
  crowded?: boolean; bigProps?: boolean; silentSteps?: boolean; bells?: boolean; phones?: boolean;
  nested?: boolean; drift?: boolean; fov?: number; snow?: boolean; hueSpin?: boolean;
}

export interface DreamLaw {
  id: string;
  name: string;
  journal: string;
  weight: number;
  deep?: boolean; // more likely on Deep nights
  fx: LawEffects;
}

export const LAWS: DreamLaw[] = [
  { id: 'feather', name: 'Feather', journal: 'Everything weighed a third of itself.', weight: 1, fx: { gravity: 0.3, floatLift: 1.6 } },
  { id: 'mirror', name: 'Mirror', journal: 'Left was right all night.', weight: 0.8, fx: { mirror: true } },
  { id: 'glass', name: 'Glass night', journal: 'Every thing was made of glass.', weight: 0.7, fx: { glass: true } },
  { id: 'giant', name: 'Giant', journal: 'I was taller than the houses.', weight: 0.5, fx: { scale: 6, speed: 3 } },
  { id: 'tiny', name: 'Tiny', journal: 'I was the size of a thimble.', weight: 0.5, fx: { scale: 0.12, speed: 0.4 } },
  { id: 'hush', name: 'Hush', journal: 'No music. Only footsteps and wind.', weight: 0.8, fx: { hush: true } },
  { id: 'backwards', name: 'Backwards', journal: 'The clocks ran home.', weight: 0.7, fx: { backwards: true } },
  { id: 'watchers', name: 'Watchers', journal: 'Every figure turned to face me, then away.', weight: 0.6, deep: true, fx: { watchersFace: true } },
  { id: 'glyphnight', name: 'Glyph night', journal: 'The world was written, not drawn.', weight: 0.6, fx: { glyph: 0.85 } },
  { id: 'long', name: 'Long night', journal: 'The night went on twice as long.', weight: 0.7, fx: { timer: 2 } },
  { id: 'sticky', name: 'Sticky', journal: 'Things held on before they let me through.', weight: 0.6, fx: { sticky: true } },
  { id: 'paper', name: 'Paper night', journal: 'Everything was folded out of paper.', weight: 0.7, fx: { paper: true } },
  { id: 'indoorrain', name: 'Indoor rain', journal: 'It rained inside, never outside.', weight: 0.6, fx: { indoorRain: true } },
  { id: 'dusk', name: 'Dusk forever', journal: 'Morning never came closer.', weight: 0.5, fx: { duskForever: true } },
  { id: 'slow', name: 'Syrup', journal: 'I moved like honey.', weight: 0.6, fx: { speed: 0.55 } },
  { id: 'quick', name: 'Quicksilver', journal: 'My feet ran ahead of me.', weight: 0.6, fx: { speed: 1.7 } },
  { id: 'mono', name: 'Old photograph', journal: 'All the colour had gone to sleep.', weight: 0.5, fx: { mono: true } },
  { id: 'negative', name: 'Negative', journal: 'Light and dark swapped coats.', weight: 0.35, deep: true, fx: { invert: true } },
  { id: 'smear', name: 'Smear', journal: 'Everything left a trail behind it.', weight: 0.6, fx: { trails: 0.95 } },
  { id: 'tape', name: 'Worn tape', journal: 'It looked like a video recorded over twice.', weight: 0.6, fx: { tape: 0.8 } },
  { id: 'kaleido', name: 'Kaleidoscope', journal: 'The edges of the world folded in sixes.', weight: 0.5, fx: { kaleido: 0.9 } },
  { id: 'wobble', name: 'Water-glass', journal: 'The air rippled like a glass of water.', weight: 0.6, fx: { wobble: 1 } },
  { id: 'fog', name: 'Thick fog', journal: 'I could not see past my hands.', weight: 0.6, deep: true, fx: { fog: 0.35 } },
  { id: 'clear', name: 'Clear air', journal: 'I could see to the end of everything.', weight: 0.5, fx: { fog: 3 } },
  { id: 'sunstruck', name: 'Sunstruck', journal: 'Every edge glowed.', weight: 0.5, fx: { bloom: 1.9 } },
  { id: 'lanterns', name: 'Lantern night', journal: 'The Lanternfolk were everywhere.', weight: 0.6, fx: { lanternfolk: 3 } },
  { id: 'moths', name: 'Moth night', journal: 'Moths settled on every light.', weight: 0.6, fx: { moths: true } },
  { id: 'echo', name: 'Echo', journal: 'Every sound came back to me.', weight: 0.6, fx: { echo: true } },
  { id: 'skyflip', name: 'Upside sky', journal: 'The sky was the wrong way up.', weight: 0.4, deep: true, fx: { skyFlip: true } },
  { id: 'moonswap', name: 'Moon swap', journal: 'The moons had traded places early.', weight: 0.5, fx: { moonSwap: true } },
  { id: 'empty', name: 'Empty', journal: 'Nobody else was there at all.', weight: 0.4, deep: true, fx: { empty: true } },
  { id: 'crowded', name: 'Crowded', journal: 'There were more of everything.', weight: 0.5, fx: { crowded: true } },
  { id: 'bigprops', name: 'Overgrown things', journal: 'Small things had grown large.', weight: 0.5, fx: { bigProps: true } },
  { id: 'silent', name: 'Soft feet', journal: 'My footsteps made no sound.', weight: 0.5, fx: { silentSteps: true } },
  { id: 'bells', name: 'Bells', journal: 'Every door I went through rang.', weight: 0.5, fx: { bells: true } },
  { id: 'phones', name: 'Ringing', journal: 'The telephone would not stop ringing.', weight: 0.4, deep: true, fx: { phones: true } },
  { id: 'nested', name: 'Nested', journal: 'I fell asleep inside the dream.', weight: 0.35, fx: { nested: true } },
  { id: 'drift', name: 'Current', journal: 'Something kept pulling me sideways.', weight: 0.5, fx: { drift: true } },
  { id: 'wide', name: 'Wide eyes', journal: 'I could see behind my ears.', weight: 0.5, fx: { fov: 110 } },
  { id: 'narrow', name: 'Keyhole', journal: 'I saw everything through a keyhole.', weight: 0.4, deep: true, fx: { fov: 48 } },
  { id: 'braille', name: 'Braille night', journal: 'The world was raised dots under my eyes.', weight: 0.4, fx: { glyph: 0.6, glyphRow: 1 } },
  { id: 'snow', name: 'Snowfall', journal: 'It snowed softly everywhere, even the sea.', weight: 0.6, fx: { snow: true } },
  { id: 'huespin', name: 'Turning colours', journal: 'The colours slowly went round.', weight: 0.5, fx: { hueSpin: true } },
];

export function combinedEffects(ids: string[]): LawEffects {
  const fx: LawEffects = {};
  for (const id of ids) {
    const law = LAWS.find((l) => l.id === id);
    if (!law) continue;
    for (const [k, v] of Object.entries(law.fx)) {
      const cur = (fx as any)[k];
      if (typeof v === 'number' && typeof cur === 'number' && ['gravity', 'speed', 'scale', 'timer'].includes(k)) (fx as any)[k] = cur * v;
      else (fx as any)[k] = v;
    }
  }
  return fx;
}

/** Laws that cannot share a night. */
export const EXCLUSIVE: string[][] = [['giant', 'tiny'], ['slow', 'quick'], ['fog', 'clear'], ['wide', 'narrow'], ['glyphnight', 'braille'], ['empty', 'crowded', 'lanterns']];
