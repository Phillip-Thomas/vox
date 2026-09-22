import { registerBeat } from '../registry.ts';
import { beatCh3Gather } from './ch3-gather.ts';
import { beatCh3Dusk } from './ch3-dusk.ts';
import { beatCh3AwaitRest } from './ch3-await-rest.ts';
import { beatA3Dawn } from './a3-dawn.ts';
import { beatCh3Thirst } from './ch3-thirst.ts';
import { beatCh3Forage } from './ch3-forage.ts';
import { beatCh3Signal } from './ch3-signal.ts';

export const CH3_BEATS = [beatCh3Gather, beatCh3Dusk, beatCh3AwaitRest, beatA3Dawn, beatCh3Thirst, beatCh3Forage, beatCh3Signal] as const;
for (const contract of CH3_BEATS) registerBeat(contract);
