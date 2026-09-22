import { describe, expect, it } from 'vitest';
import {
  BED_ALIVE_LIFT,
  BED_LEAN_BALANCE_DB,
  BED_ALIVE_LUFS_I,
  BED_NIGHT_TRIM_DAYLIGHT_ONSET,
  BED_NIGHT_TRIM_DB,
  BED_XOVER_HZ,
  BLOOM_ST_LUFS,
  DRIVE_LEAD_K,
  DRIVE_PAD_K,
  DRIVE_PAD_WET_ALIVE,
  DRIVE_SUB_K,
  DRIVE_THERMAL_WET_LIFT,
  GLUE_ATTACK_S,
  GLUE_KNEE_DB,
  GLUE_MAKEUP_COMP_DB,
  GLUE_RATIO,
  GLUE_RELEASE_S,
  GLUE_THRESH_DB,
  PAD_UNISON_CENTS,
  PAD_UNISON_FULL,
  PAD_UNISON_LEAN,
  PAD_UNISON_PAN_SPREAD,
  PAD_VOICES_FULL,
  PAD_VOICES_LEAN,
  REVERB_EARLY_WINDOW_MS,
  REVERB_HF_DAMP_HZ,
  REVERB_PREDELAY_MS,
  SOFTCLIP_K,
  SUB_HP_HZ,
  SUB_LP_HZ,
  TARGET_LUFS_I,
  TARGET_TP_DBTP
} from './tuning.ts';
import { bedNightTrimDepth, resolveStage1Rails, unisonCentsFor, type Stage1Rails } from '../bedEngine.ts';
import { tanhDriveCeiling } from './timbre.ts';

// Stage 1 constants are owner-retunable, but their RELATIONS are law: the
// targets order correctly, the tiers never exceed the full graph, every drive
// curve is a real curve, and the glue is a glue (gentle) rather than a limiter.
describe('Stage 1 tuning relations', () => {
  it('orders the loudness targets: bed under the sum, BLOOM above, true peak under 0', () => {
    expect(BED_ALIVE_LUFS_I).toBeLessThan(TARGET_LUFS_I);
    expect(TARGET_LUFS_I - BED_ALIVE_LUFS_I).toBeGreaterThanOrEqual(2);
    expect(TARGET_LUFS_I - BED_ALIVE_LUFS_I).toBeLessThanOrEqual(3);
    expect(BLOOM_ST_LUFS).toBeGreaterThan(TARGET_LUFS_I);
    expect(TARGET_TP_DBTP).toBeLessThan(0);
    expect(TARGET_TP_DBTP).toBeGreaterThanOrEqual(-1);
  });

  it('keeps the lean tier inside the full tier and all colour tones reachable', () => {
    expect(PAD_VOICES_LEAN).toBeLessThan(PAD_VOICES_FULL);
    expect(PAD_UNISON_LEAN).toBeLessThan(PAD_UNISON_FULL);
    // publish.tones = bass + 3 uppers + up to 2 colour tones → 5 upper voices sound them all.
    expect(PAD_VOICES_FULL).toBe(5);
    expect(PAD_VOICES_LEAN).toBeGreaterThanOrEqual(3);
  });

  it('builds symmetric unison offsets from the named cents table', () => {
    expect(unisonCentsFor(PAD_UNISON_FULL)).toEqual([-17, -9, -3, 3, 9, 17]);
    expect(unisonCentsFor(PAD_UNISON_LEAN)).toEqual([-3, 0, 3]);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const cents = unisonCentsFor(n);
      expect(cents).toHaveLength(n);
      expect(cents.reduce((a, b) => a + b, 0)).toBe(0);
      expect(Math.max(...cents.map(Math.abs))).toBeLessThanOrEqual(Math.max(...PAD_UNISON_CENTS));
    }
    expect(PAD_UNISON_PAN_SPREAD).toBeGreaterThan(0);
    expect(PAD_UNISON_PAN_SPREAD).toBeLessThanOrEqual(1);
  });

  it('keeps every drive a unity-slope curve with a real ceiling and a bounded wet blend', () => {
    for (const k of [DRIVE_PAD_K, DRIVE_SUB_K, DRIVE_LEAD_K, SOFTCLIP_K]) {
      expect(k).toBeGreaterThan(1);
      expect(tanhDriveCeiling(k)).toBeLessThan(1);
      expect(tanhDriveCeiling(k)).toBeGreaterThan(0.5);
    }
    expect(DRIVE_PAD_WET_ALIVE * (1 + DRIVE_THERMAL_WET_LIFT)).toBeLessThanOrEqual(1);
  });

  it('keeps the glue gentle and at unity static gain, below the untouched safety compressor ratio', () => {
    expect(GLUE_RATIO).toBeLessThan(8);
    expect(GLUE_RATIO).toBeGreaterThan(1);
    expect(GLUE_THRESH_DB).toBeLessThan(0);
    expect(GLUE_KNEE_DB).toBeGreaterThan(0);
    expect(GLUE_ATTACK_S).toBeGreaterThan(0);
    expect(GLUE_RELEASE_S).toBeGreaterThan(GLUE_ATTACK_S);
    // Chrome's baked makeup for these settings, measured at +4.27 dB, is cancelled.
    expect(GLUE_MAKEUP_COMP_DB).toBeLessThan(0);
    expect(GLUE_MAKEUP_COMP_DB).toBeGreaterThan(-8);
  });

  it('keeps the sub design band and the room constants physically ordered', () => {
    expect(SUB_HP_HZ).toBeLessThan(SUB_LP_HZ);
    expect(SUB_LP_HZ).toBeLessThanOrEqual(BED_XOVER_HZ);
    expect(REVERB_EARLY_WINDOW_MS[0]).toBeLessThan(REVERB_EARLY_WINDOW_MS[1]);
    expect(REVERB_PREDELAY_MS).toBeGreaterThan(0);
    expect(REVERB_HF_DAMP_HZ).toBeGreaterThan(1000);
    expect(BED_ALIVE_LIFT).toBeGreaterThan(0);
  });
});

// The era-gate law, as a unit test rather than two rendered hashes: every
// Stage 1 rail is a pure function of world signals, and at padChoir 0 (bare and
// colour, era ≤ 0.38) every ACTIVE rail is exactly 0, every BYPASS rail exactly 1
// and the alive trim exactly 1 — so the chip eras are untouched by construction,
// whatever thermal, golden, daylight, wind or arrangement level the world sends.
const ACTIVE_RAILS: readonly (keyof Stage1Rails)[] = [
  'padBusLevel',
  'padOctaveLevel',
  'padWanderDepthHz',
  'padOrganLevel',
  'padSpectralDepthHz',
  'padDriveWet',
  'padBreathLevel',
  'xoverLow',
  'xoverHigh',
  'subDesignOut',
  'subDriveWet',
  'leadDriveWet'
];
const BYPASS_RAILS: readonly (keyof Stage1Rails)[] = ['xoverBypass', 'subDesignBypass'];
const UNIT_GRID = [0, 0.04, 0.25, 0.5, 0.82, 1];

describe('signed v6 lean calibration boundary', () => {
  it('changes only the material-plus bed/room trim, preserving full and early bypass exactly', () => {
    const q = Math.pow(10, BED_LEAN_BALANCE_DB / 20);
    expect(q).toBe(0.8659643233600653);
    for (const daylight of UNIT_GRID) for (const padChoir of UNIT_GRID) {
      const input = { daylight, padChoir, thermal: 0.3, golden: 0.2, windTurbulence: 0.4, padLevel: 0.7, padVoiceCount: PAD_VOICES_FULL };
      const original = resolveStage1Rails(input);
      const full = resolveStage1Rails({ ...input, quality: 'full' });
      const lean = resolveStage1Rails({ ...input, quality: 'lean' });
      expect(full).toEqual(original);
      const nightTrim = Math.pow(10, BED_NIGHT_TRIM_DB * bedNightTrimDepth(daylight) / 20);
      expect(full.aliveTrim).toBe(1 - (1 - BED_ALIVE_LIFT * nightTrim) * padChoir);
      expect(lean.aliveTrim).toBe(1 - (1 - BED_ALIVE_LIFT * nightTrim * q) * padChoir);
      expect({ ...lean, aliveTrim: full.aliveTrim }).toEqual(full);
      if (padChoir === 0) expect(lean.aliveTrim).toBe(1);
      else expect(lean.aliveTrim).toBeLessThan(full.aliveTrim);
    }
  });
});

describe('Stage 1 rails at padChoir 0 (bare/colour era law)', () => {
  it('resolves every active rail to exactly 0, every bypass to exactly 1, alive trim to exactly 1', () => {
    for (const thermal of UNIT_GRID) {
      for (const golden of UNIT_GRID) {
        for (const daylight of UNIT_GRID) {
          for (const windTurbulence of UNIT_GRID) {
            for (const padLevel of [0, 0.4, 1]) {
              for (const padVoiceCount of [PAD_VOICES_LEAN, PAD_VOICES_FULL]) {
                const rails = resolveStage1Rails({
                  padChoir: 0,
                  thermal,
                  golden,
                  daylight,
                  windTurbulence,
                  padLevel,
                  padVoiceCount
                });
                for (const key of ACTIVE_RAILS) expect(rails[key], key).toBe(0);
                for (const key of BYPASS_RAILS) expect(rails[key], key).toBe(1);
                expect(rails.aliveTrim).toBe(1);
              }
            }
          }
        }
      }
    }
  });

  it('covers every rail the resolver publishes (no unclassified rail can slip past the law)', () => {
    const rails = resolveStage1Rails({
      padChoir: 1, thermal: 1, golden: 1, daylight: 0, windTurbulence: 1, padLevel: 1, padVoiceCount: PAD_VOICES_FULL
    });
    const classified = new Set<string>([...ACTIVE_RAILS, ...BYPASS_RAILS, 'aliveTrim']);
    expect(Object.keys(rails).sort()).toEqual([...classified].sort());
  });

  it('opens the rails monotonically with padChoir and keeps blends complementary', () => {
    let previous: Stage1Rails | null = null;
    for (const padChoir of [0, 0.1, 0.35, 0.6, 0.85, 1]) {
      const rails = resolveStage1Rails({
        padChoir, thermal: 0.3, golden: 0.2, daylight: 0.82, windTurbulence: 0.4, padLevel: 0.7, padVoiceCount: PAD_VOICES_FULL
      });
      expect(rails.xoverBypass + rails.xoverLow).toBeCloseTo(1, 12);
      expect(rails.subDesignBypass + rails.subDesignOut).toBeCloseTo(1, 12);
      expect(rails.padDriveWet).toBeLessThanOrEqual(1);
      expect(rails.subDriveWet).toBeLessThanOrEqual(1);
      if (previous) {
        for (const key of ACTIVE_RAILS) expect(rails[key]).toBeGreaterThanOrEqual(previous[key]);
      }
      previous = rails;
    }
  });
});

describe('Stage 1 alive-bed night trim (D4)', () => {
  const rails = (padChoir: number, daylight: number) =>
    resolveStage1Rails({ padChoir, thermal: 0, golden: 0, daylight, windTurbulence: 0, padLevel: 1, padVoiceCount: PAD_VOICES_FULL });

  it('is a trim (negative dB) that engages below the daylight onset only', () => {
    expect(BED_NIGHT_TRIM_DB).toBeLessThan(0);
    expect(BED_NIGHT_TRIM_DB).toBeGreaterThanOrEqual(-4);
    expect(BED_NIGHT_TRIM_DAYLIGHT_ONSET).toBeGreaterThan(0);
    expect(BED_NIGHT_TRIM_DAYLIGHT_ONSET).toBeLessThan(1);
    for (const daylight of [BED_NIGHT_TRIM_DAYLIGHT_ONSET, 0.82, 1]) expect(bedNightTrimDepth(daylight)).toBe(0);
    expect(bedNightTrimDepth(0)).toBe(1);
    expect(bedNightTrimDepth(0.04)).toBeGreaterThan(0.95);
  });

  it('leaves every daylight render bit-identical: alive trim equals BED_ALIVE_LIFT exactly at padChoir 1', () => {
    for (const daylight of [BED_NIGHT_TRIM_DAYLIGHT_ONSET, 0.6, 0.82, 1]) {
      expect(rails(1, daylight).aliveTrim).toBe(BED_ALIVE_LIFT);
      expect(rails(0.5, daylight).aliveTrim).toBe(1 - (1 - BED_ALIVE_LIFT) * 0.5);
    }
  });

  it('lands the full-night trim at BED_NIGHT_TRIM_DB below the alive lift and moves continuously through dusk', () => {
    const night = rails(1, 0).aliveTrim;
    expect(20 * Math.log10(night / BED_ALIVE_LIFT)).toBeCloseTo(BED_NIGHT_TRIM_DB, 9);
    let previous = rails(1, 0).aliveTrim;
    for (let daylight = 0.02; daylight <= 1.0001; daylight += 0.02) {
      const next = rails(1, daylight).aliveTrim;
      expect(next).toBeGreaterThanOrEqual(previous);
      // Smoothstep's peak slope is 1.5, so the steepest dusk step is
      // |BED_NIGHT_TRIM_DB| × 1.5 × (0.02 / onset) dB — a slewable rail, not a switch.
      const steepestStepDb = Math.abs(BED_NIGHT_TRIM_DB) * 1.5 * (0.02 / BED_NIGHT_TRIM_DAYLIGHT_ONSET);
      expect(20 * Math.log10(next / previous)).toBeLessThanOrEqual(steepestStepDb + 1e-9);
      expect(steepestStepDb).toBeLessThan(0.25);
      previous = next;
    }
  });
});
