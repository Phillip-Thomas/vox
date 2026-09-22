import { registerBeat } from '../registry.ts';
import { beatCh6Dive } from './ch6-dive.ts';

export const CH6_BEATS = [beatCh6Dive] as const;
for (const contract of CH6_BEATS) registerBeat(contract);
