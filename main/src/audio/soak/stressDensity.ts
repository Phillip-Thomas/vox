import { oxygenPulseVoices, sfxRecipe, type SfxEvent, type SfxVoice } from '../sfxEngine.ts';
import type { SfxScriptCue } from './offlineRender.ts';

export interface StressDensity {
  seconds: number;
  oneShots: { family: string; triggers: number; triggersPerMinute: number; firstAtS: number; lastAtS: number; nominalVoiceGains: number[]; nominalVoiceDurationsS: number[] }[];
  loops: { family: string; intervals: { fromS: number; toS: number; level: number; nominalSourceGain: number }[]; activeSeconds: number; dutyCycle: number }[];
  controls: SfxScriptCue[];
}

/** Declaration from the actual script and shipped recipes, before variation,
 * ducking, room sends or mastering. A loop is reported by duty cycle, not by
 * counting its on/off messages as individual audible effects. */
export function describeStressDensity(cues: readonly SfxScriptCue[], seconds: number): StressDensity {
  const oneShots = new Map<string, StressDensity['oneShots'][number]>();
  const loops = new Map<string, StressDensity['loops'][number]>();
  const active = new Map<string, { fromS: number; level: number }>();
  const controls: SfxScriptCue[] = [];
  const closeLoop = (family: string, toS: number) => {
    const prior = active.get(family);
    if (!prior) return;
    const loop = loops.get(family)!;
    const end = Math.min(seconds, toS);
    loop.intervals.push({ ...prior, toS: end, nominalSourceGain: prior.level * (family === 'jetpack' ? 0.075 : 0.045) });
    loop.activeSeconds += Math.max(0, end - prior.fromS);
    loop.dutyCycle = loop.activeSeconds / seconds;
    active.delete(family);
  };
  for (const cue of [...cues].sort((a, b) => a.t - b.t)) {
    if (cue.t < 0 || cue.t >= seconds) continue;
    if (cue.event === 'submerge') { controls.push(cue); continue; }
    if (cue.event === 'jetpack' || cue.event === 'shipThrust') {
      if (!loops.has(cue.event)) loops.set(cue.event, { family: cue.event, intervals: [], activeSeconds: 0, dutyCycle: 0 });
      closeLoop(cue.event, cue.t);
      const level = cue.event === 'jetpack'
        ? cue.params?.active ? cue.params.intensity ?? 1 : 0
        : cue.params?.level ?? 0;
      if (level > 0) active.set(cue.event, { fromS: cue.t, level });
      continue;
    }
    const voices: readonly SfxVoice[] = cue.event === 'oxygenPulse'
      ? oxygenPulseVoices({ active: true, oxygen: 0, urgency: 1, pulseIntervalSeconds: 1, pulseGain: cue.params?.pulseGain ?? 0, criticalBreathGain: cue.params?.criticalBreathGain ?? 0, criticalBreathDurationSeconds: cue.params?.criticalBreathDurationSeconds ?? 0 })
      : sfxRecipe(cue.event as SfxEvent);
    const row = oneShots.get(cue.event) ?? { family: cue.event, triggers: 0, triggersPerMinute: 0, firstAtS: cue.t, lastAtS: cue.t, nominalVoiceGains: [], nominalVoiceDurationsS: [] };
    row.triggers++;
    row.triggersPerMinute = row.triggers * 60 / seconds;
    row.lastAtS = cue.t;
    for (const voice of voices) {
      if (!row.nominalVoiceGains.includes(voice.gain)) row.nominalVoiceGains.push(voice.gain);
      if (!row.nominalVoiceDurationsS.includes(voice.duration)) row.nominalVoiceDurationsS.push(voice.duration);
    }
    oneShots.set(cue.event, row);
  }
  for (const family of active.keys()) closeLoop(family, seconds);
  return { seconds, oneShots: [...oneShots.values()], loops: [...loops.values()], controls };
}
