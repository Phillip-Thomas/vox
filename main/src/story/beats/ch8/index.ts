import { registerBeat } from '../registry.ts';
import { beatCh8Launch } from './ch8-launch.ts';
import { beatCh8Crossing } from './ch8-crossing.ts';
import { beatCh8Landfall } from './ch8-landfall.ts';

export const CH8_BEATS = [beatCh8Launch, beatCh8Crossing, beatCh8Landfall] as const;
for (const contract of CH8_BEATS) registerBeat(contract);
