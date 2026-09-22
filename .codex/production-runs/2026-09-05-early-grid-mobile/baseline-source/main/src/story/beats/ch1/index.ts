import { registerBeat } from '../registry.ts';
import { beatDescent } from './descent.ts';
import { beatCh1Fixed } from './ch1-fixed.ts';
import { beatCh1Track } from './ch1-track.ts';
import { beatCh1Raster } from './ch1-raster.ts';
import { beatCh1Depth } from './ch1-depth.ts';
import { beatCh1Nav } from './ch1-nav.ts';
import { beatCh1Iso } from './ch1-iso.ts';
import { beatCh1Lift } from './ch1-lift.ts';
import { beatCh1Anomaly } from './ch1-anomaly.ts';
import { beatA1Ramp } from './a1-ramp.ts';

export const CH1_BEATS = [beatDescent, beatCh1Fixed, beatCh1Track, beatCh1Raster, beatCh1Depth, beatCh1Nav, beatCh1Iso, beatCh1Lift, beatCh1Anomaly, beatA1Ramp] as const;
for (const contract of CH1_BEATS) registerBeat(contract);
