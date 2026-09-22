import type { SfxVoice, SfxToneVoice, SfxNoiseVoice } from '../sfxEngine.ts';

const tone = (from: number, to: number, duration: number, gain = 0.018, delay = 0): SfxToneVoice => ({ kind: 'tone', type: 'square', from, to, duration, gain, delay });
const noise = (from: number, to: number, duration: number, gain = 0.025): SfxNoiseVoice => ({ kind: 'noise', type: 'bandpass', from, to, duration, gain, q: 0.8 });
/** Additive recipe descriptors; the shipped recipes remain their nominal reference. */
export const COVERAGE_RECIPES = {
  footstep: [noise(480, 180, 0.12, 0.018)],
  craftSuccess: [tone(330, 330, 0.06), tone(495, 495, 0.1, 0.02, 0.08)],
  buildSuccess: [noise(180, 95, 0.16), tone(220, 440, 0.13, 0.018)],
  inventoryAcquire: [{ ...tone(440, 660, 0.07, 0.012), type: 'triangle' }],
  uiHover: [tone(700, 700, 0.025, 0.006)],
  uiClick: [tone(880, 880, 0.04, 0.01)],
  uiBack: [tone(660, 440, 0.065, 0.012)],
  uiError: [tone(180, 150, 0.1, 0.015)],
  hatch: [noise(240, 800, 0.55, 0.035), tone(120, 90, 0.2, 0.016, 0.38)],
  stationHum: [{ kind: 'tone', type: 'sine', from: 55, to: 55, duration: 2.4, gain: 0.012 }],
  waterLap: [noise(380, 160, 1.1, 0.016)],
  objectiveEnter: [tone(520, 520, 0.05, 0.006), tone(700, 700, 0.05, 0.0054, 0.07)],
  objectiveProgress: [tone(520, 520, 0.04, 0.003)],
  objectiveComplete: [tone(700, 700, 0.05, 0.006), tone(700 * 2 / 3, 700 * 2 / 3, 0.18, 0.0054, 0.07)],
  objectiveFail: [tone(130, 130, 0.26, 0.006), noise(500, 120, 0.26, 0.005)],
  markerAcquired: [tone(1040, 1040, 0.03, 0.0025), { kind: 'noise', type: 'highpass', from: 2200, to: 1600, duration: 0.025, gain: 0.0018 }]
} satisfies Record<string, readonly SfxVoice[]>;
export type CoverageSfxEvent = keyof typeof COVERAGE_RECIPES;

/** Material is heard only once the existing material gate opens. */
export function footstepRecipe(material: string | undefined, materialGate: number): readonly SfxVoice[] {
  if (!material || materialGate <= 0) return COVERAGE_RECIPES.footstep;
  const hard = /stone|ore|iron|copper|metal|crystal|brick/.test(material);
  const soft = /grass|sand|soil|dirt|leaf|snow/.test(material);
  const band = hard ? 1700 : soft ? 420 : 850;
  return [noise(480 + (band - 480) * materialGate, 180, 0.12, 0.018),
    { kind: 'tone', type: 'sine', from: hard ? 130 : 85, to: 55, duration: 0.09, gain: 0.008 * materialGate }];
}
