import { registerBeat } from '../registry.ts';
import { beatCh10Cold } from './ch10-cold.ts';
import { beatCh10Ask } from './ch10-ask.ts';
import { beatCh10Transit } from './ch10-transit.ts';

export const CH10_BEATS = [beatCh10Cold, beatCh10Ask, beatCh10Transit] as const;
for (const contract of CH10_BEATS) registerBeat(contract);
