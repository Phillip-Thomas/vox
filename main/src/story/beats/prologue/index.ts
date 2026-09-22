import { registerBeat } from '../registry.ts';
import { beatCrawl } from './crawl.ts';
import { beatManifest } from './manifest.ts';
import { beatVoyage } from './voyage.ts';
import { beatDeflect } from './deflect.ts';
import { beatCrash } from './crash.ts';

export const PROLOGUE_BEATS = [beatCrawl, beatManifest, beatVoyage, beatDeflect, beatCrash] as const;
for (const contract of PROLOGUE_BEATS) registerBeat(contract);
