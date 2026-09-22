import { registerBeat } from '../registry.ts';
import { beatCh9Settle } from './ch9-settle.ts';
import { beatCh9Hearth } from './ch9-hearth.ts';

export const CH9_BEATS = [beatCh9Settle, beatCh9Hearth] as const;
for (const contract of CH9_BEATS) registerBeat(contract);
