import { registerBeat } from '../registry.ts';
import { beatCh2Color } from './ch2-color.ts';
import { beatCh2Approach } from './ch2-approach.ts';
import { beatA2Awakening } from './a2-awakening.ts';

export const CH2_BEATS = [beatCh2Color, beatCh2Approach, beatA2Awakening] as const;
for (const contract of CH2_BEATS) registerBeat(contract);
