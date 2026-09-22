import { registerBeat } from '../registry.ts';
import { beatCh7Reconstruct } from './ch7-reconstruct.ts';
import { beatCh7Board } from './ch7-board.ts';

export const CH7_BEATS = [beatCh7Reconstruct, beatCh7Board] as const;
for (const contract of CH7_BEATS) registerBeat(contract);
