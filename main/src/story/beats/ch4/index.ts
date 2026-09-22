import { registerBeat } from '../registry.ts';
import { beatCh4Vigil } from './ch4-vigil.ts';
import { beatCh4Arrival } from './ch4-arrival.ts';
import { beatCh4Audit } from './ch4-audit.ts';
import { beatCh4Comply } from './ch4-comply.ts';
import { beatCh4Defy } from './ch4-defy.ts';
import { beatA4Exhale } from './a4-exhale.ts';

export const CH4_BEATS = [beatCh4Vigil, beatCh4Arrival, beatCh4Audit, beatCh4Comply, beatCh4Defy, beatA4Exhale] as const;
for (const contract of CH4_BEATS) registerBeat(contract);
