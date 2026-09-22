import { registerBeat } from '../registry.ts';
import { beatCh5Maw } from './ch5-maw.ts';

export const CH5_BEATS = [beatCh5Maw] as const;
for (const contract of CH5_BEATS) registerBeat(contract);
