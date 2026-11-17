import type { RealmId } from '../data/types';
import type { RealmContext } from '../core/types';
import type { Realm } from './realm';
import { LanternFlat } from './flat';
import { CloudOrchard } from './orchard';
import { LanternMarket } from './market';
import { PrismCathedral } from './cathedral';
import { EveningSuburb } from './suburb';
import { TidalStair } from './stair';
import { OrigamiMetro } from './metro';
import { DrownedLibrary } from './library';
import { StaticField } from './static';
import { FractalReef } from './reef';
import { TheVeins } from './veins';
import { GlyphDesert } from './desert';
import { NightSchool } from './school';
import { Threshold, Orrery, ChorusRoom } from './special';

const CTORS: Record<RealmId, new (ctx: RealmContext) => Realm> = {
  flat: LanternFlat, orchard: CloudOrchard, market: LanternMarket, cathedral: PrismCathedral, suburb: EveningSuburb,
  stair: TidalStair, metro: OrigamiMetro, library: DrownedLibrary, static: StaticField, reef: FractalReef, veins: TheVeins,
  desert: GlyphDesert, school: NightSchool, threshold: Threshold, orrery: Orrery, chorus: ChorusRoom,
};

export function createRealm(ctx: RealmContext): Realm {
  return new CTORS[ctx.id](ctx);
}
