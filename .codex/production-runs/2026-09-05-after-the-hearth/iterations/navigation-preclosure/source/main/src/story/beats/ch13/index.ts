import { registerBeat } from '../registry.ts';
import { beatCh13Home } from './ch13-home.ts';
import { beatCh13Return } from './ch13-return.ts';
import { beatCh13Survey } from './ch13-survey.ts';
import { beatCh13Common } from './ch13-common.ts';

export const CH13_BEATS = [beatCh13Home, beatCh13Return, beatCh13Survey, beatCh13Common] as const;
for (const contract of CH13_BEATS) registerBeat(contract);
