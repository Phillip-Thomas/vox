// Generated from authored beat declarations. Run npm run chapter:registry:generate.
import type { StoryBeat } from '../storyState.ts';
import type { BeatContract } from './beatContract.ts';
import { beatCrawl } from './prologue/crawl.ts';
import { beatManifest } from './prologue/manifest.ts';
import { beatVoyage } from './prologue/voyage.ts';
import { beatDeflect } from './prologue/deflect.ts';
import { beatCrash } from './prologue/crash.ts';
import { beatDescent } from './ch1/descent.ts';
import { beatCh1Fixed } from './ch1/ch1-fixed.ts';
import { beatCh1Track } from './ch1/ch1-track.ts';
import { beatCh1Raster } from './ch1/ch1-raster.ts';
import { beatCh1Depth } from './ch1/ch1-depth.ts';
import { beatCh1Nav } from './ch1/ch1-nav.ts';
import { beatCh1Iso } from './ch1/ch1-iso.ts';
import { beatCh1Lift } from './ch1/ch1-lift.ts';
import { beatCh1Anomaly } from './ch1/ch1-anomaly.ts';
import { beatA1Ramp } from './ch1/a1-ramp.ts';
import { beatCh2Color } from './ch2/ch2-color.ts';
import { beatCh2Approach } from './ch2/ch2-approach.ts';
import { beatA2Awakening } from './ch2/a2-awakening.ts';
import { beatCh3Gather } from './ch3/ch3-gather.ts';
import { beatCh3Dusk } from './ch3/ch3-dusk.ts';
import { beatCh3AwaitRest } from './ch3/ch3-await-rest.ts';
import { beatA3Dawn } from './ch3/a3-dawn.ts';
import { beatCh3Thirst } from './ch3/ch3-thirst.ts';
import { beatCh3Forage } from './ch3/ch3-forage.ts';
import { beatCh3Signal } from './ch3/ch3-signal.ts';
import { beatCh4Vigil } from './ch4/ch4-vigil.ts';
import { beatCh4Arrival } from './ch4/ch4-arrival.ts';
import { beatCh4Audit } from './ch4/ch4-audit.ts';
import { beatCh4Comply } from './ch4/ch4-comply.ts';
import { beatCh4Defy } from './ch4/ch4-defy.ts';
import { beatA4Exhale } from './ch4/a4-exhale.ts';
import { beatCh5Maw } from './ch5/ch5-maw.ts';
import { beatCh6Dive } from './ch6/ch6-dive.ts';
import { beatCh7Reconstruct } from './ch7/ch7-reconstruct.ts';
import { beatCh7Board } from './ch7/ch7-board.ts';
import { beatCh8Launch } from './ch8/ch8-launch.ts';
import { beatCh8Crossing } from './ch8/ch8-crossing.ts';
import { beatCh8Landfall } from './ch8/ch8-landfall.ts';
import { beatCh9Settle } from './ch9/ch9-settle.ts';
import { beatCh9Hearth } from './ch9/ch9-hearth.ts';
import { beatCh10Cold } from './ch10/ch10-cold.ts';
import { beatCh10Ask } from './ch10/ch10-ask.ts';
import { beatCh10Transit } from './ch10/ch10-transit.ts';
import { beatCh13Home } from './ch13/ch13-home.ts';
import { beatCh13Return } from './ch13/ch13-return.ts';
import { beatCh13Survey } from './ch13/ch13-survey.ts';
import { beatCh13Common } from './ch13/ch13-common.ts';
import { beatCh14Record } from './ch14/ch14-record.ts';
import { beatCh14Scar } from './ch14/ch14-scar.ts';
import { beatCh14Question } from './ch14/ch14-question.ts';
import { beatCh14Return } from './ch14/ch14-return.ts';

export const BEAT_DEFINITIONS: Partial<Record<StoryBeat, BeatContract>> = {
  'crawl': beatCrawl,
  'manifest': beatManifest,
  'voyage': beatVoyage,
  'deflect': beatDeflect,
  'crash': beatCrash,
  'descent': beatDescent,
  'ch1-fixed': beatCh1Fixed,
  'ch1-track': beatCh1Track,
  'ch1-raster': beatCh1Raster,
  'ch1-depth': beatCh1Depth,
  'ch1-nav': beatCh1Nav,
  'ch1-iso': beatCh1Iso,
  'ch1-lift': beatCh1Lift,
  'ch1-anomaly': beatCh1Anomaly,
  'a1-ramp': beatA1Ramp,
  'ch2-color': beatCh2Color,
  'ch2-approach': beatCh2Approach,
  'a2-awakening': beatA2Awakening,
  'ch3-gather': beatCh3Gather,
  'ch3-dusk': beatCh3Dusk,
  'ch3-await-rest': beatCh3AwaitRest,
  'a3-dawn': beatA3Dawn,
  'ch3-thirst': beatCh3Thirst,
  'ch3-forage': beatCh3Forage,
  'ch3-signal': beatCh3Signal,
  'ch4-vigil': beatCh4Vigil,
  'ch4-arrival': beatCh4Arrival,
  'ch4-audit': beatCh4Audit,
  'ch4-comply': beatCh4Comply,
  'ch4-defy': beatCh4Defy,
  'a4-exhale': beatA4Exhale,
  'ch5-maw': beatCh5Maw,
  'ch6-dive': beatCh6Dive,
  'ch7-reconstruct': beatCh7Reconstruct,
  'ch7-board': beatCh7Board,
  'ch8-launch': beatCh8Launch,
  'ch8-crossing': beatCh8Crossing,
  'ch8-landfall': beatCh8Landfall,
  'ch9-settle': beatCh9Settle,
  'ch9-hearth': beatCh9Hearth,
  'ch10-cold': beatCh10Cold,
  'ch10-ask': beatCh10Ask,
  'ch10-transit': beatCh10Transit,
  'ch13-home': beatCh13Home,
  'ch13-return': beatCh13Return,
  'ch13-survey': beatCh13Survey,
  'ch13-common': beatCh13Common,
  'ch14-record': beatCh14Record,
  'ch14-scar': beatCh14Scar,
  'ch14-question': beatCh14Question,
  'ch14-return': beatCh14Return
};
