import { registerBeat } from '../registry.ts';
import { beatCh14Record } from './ch14-record.ts';
import { beatCh14Scar } from './ch14-scar.ts';
import { beatCh14Question } from './ch14-question.ts';
import { beatCh14Return } from './ch14-return.ts';

export const CH14_BEATS = [beatCh14Record, beatCh14Scar, beatCh14Question, beatCh14Return] as const;
for (const contract of CH14_BEATS) registerBeat(contract);
