import { describe, expect, it } from 'vitest';
import {
  eraFade,
  neutralBedSignals,
  resolveClockPressure,
  resolveEraGates,
  resolveMacroDrift,
  resolveWorldClockTick,
  type BedSignals
} from './worldSignals.ts';
import {
  CHIP_FOLDBACK_LEVEL,
  DRIFT_MODE_DEPTH,
  ERA_ALIVE,
  ERA_COLOR,
  ERA_MATERIAL,
  REGISTER_SHIFT_MAX,
  TICK_GATE,
  TICK_HZ_BASE,
  TICK_HZ_MAX,
  TICK_HZ_MIN
} from './tuning.ts';

const sig = (patch: Partial<BedSignals>): BedSignals => ({ ...neutralBedSignals(), ...patch });

describe('world-clock tick (§8.1, owner ruling #2)', () => {
  it('ticks once per real second at rest', () => {
    const t = resolveWorldClockTick(sig({ tension: 0.9 }));
    expect(t.hz).toBe(TICK_HZ_BASE);
  });

  it('tension gates presence but NEVER drives rate', () => {
    const calm = resolveWorldClockTick(sig({ tension: 0.1 }));
    const tense = resolveWorldClockTick(sig({ tension: 1 }));
    expect(calm.present).toBe(false);
    expect(tense.present).toBe(true);
    expect(calm.hz).toBe(tense.hz);
    expect(resolveWorldClockTick(sig({ tension: TICK_GATE + 0.01 })).present).toBe(true);
  });

  it('warp compresses time, descent accelerates, depth dilates — all clamped', () => {
    const base = resolveClockPressure(sig({}));
    expect(resolveClockPressure(sig({ warpActive: true }))).toBeGreaterThan(base);
    expect(resolveClockPressure(sig({ scene: 'descent' }))).toBeGreaterThan(base);
    expect(resolveClockPressure(sig({ submergence: 1 }))).toBeLessThan(base);
    const extreme = resolveWorldClockTick(
      sig({ scene: 'descent', warpActive: true, warpProgress: 1 })
    );
    expect(extreme.hz).toBeLessThanOrEqual(TICK_HZ_MAX);
    const slow = resolveWorldClockTick(sig({ submergence: 1 }));
    expect(slow.hz).toBeGreaterThanOrEqual(TICK_HZ_MIN);
  });

  it('descent and warp force presence regardless of tension', () => {
    expect(resolveWorldClockTick(sig({ scene: 'descent', tension: 0 })).present).toBe(true);
    expect(resolveWorldClockTick(sig({ warpActive: true, tension: 0 })).present).toBe(true);
  });
});

describe('era instrumentation ladder (§8.5 — ramp, not staircase)', () => {
  it('bare is chip-only; nothing else sounds', () => {
    const g = resolveEraGates(0, 'bare');
    expect(g.chip).toBe(1);
    expect(g.padChoir).toBe(0);
    expect(g.stereoWidth).toBe(0);
    expect(g.reverb).toBe(0);
    expect(g.shimmer).toBe(0);
    expect(g.sub).toBe(0);
  });

  it('unlocks complete exactly at their rung thresholds', () => {
    expect(resolveEraGates(ERA_COLOR, 'color').sub).toBe(1);
    expect(resolveEraGates(ERA_COLOR, 'color').delay).toBe(1);
    expect(resolveEraGates(ERA_MATERIAL, 'material').padChoir).toBe(1);
    expect(resolveEraGates(ERA_MATERIAL, 'material').sidechain).toBe(1);
    expect(resolveEraGates(ERA_ALIVE, 'alive').shimmer).toBe(1);
    expect(resolveEraGates(1, 'alive').stereoWidth).toBe(1);
    expect(resolveEraGates(1, 'alive').reverb).toBe(1);
  });

  it('gates fade (strictly between 0 and 1 just below a threshold)', () => {
    const g = resolveEraGates(ERA_MATERIAL - 0.05, 'color');
    expect(g.padChoir).toBeGreaterThan(0);
    expect(g.padChoir).toBeLessThan(1);
  });

  it('chip fades out through material and folds back at paradox (owner ruling #5)', () => {
    expect(resolveEraGates(1, 'alive').chip).toBe(0);
    expect(resolveEraGates(1, 'paradox').chip).toBe(CHIP_FOLDBACK_LEVEL);
  });

  it('eraFade is monotonic in era', () => {
    let prev = -1;
    for (let e = 0; e <= 1.001; e += 0.05) {
      const v = eraFade(e, ERA_MATERIAL);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('macro-drift clocks (§7.3 — co-prime weather)', () => {
  it('is deterministic per (seed, time)', () => {
    const a = resolveMacroDrift(1234, 500, 0.7);
    const b = resolveMacroDrift(1234, 500, 0.7);
    expect(a).toEqual(b);
  });

  it('two planets drift with different phases', () => {
    const a = resolveMacroDrift(1111, 300, 0.7);
    const b = resolveMacroDrift(2222, 300, 0.7);
    expect(a.warmthBias === b.warmthBias && a.registerShift === b.registerShift).toBe(false);
  });

  it('stays inside its bounds across an hour', () => {
    for (let t = 0; t < 3600; t += 60) {
      const d = resolveMacroDrift(777, t, 0);
      expect(Math.abs(d.warmthBias)).toBeLessThanOrEqual(DRIFT_MODE_DEPTH);
      expect(Math.abs(d.registerShift)).toBeLessThanOrEqual(REGISTER_SHIFT_MAX);
      expect(d.textureLean).toBeGreaterThanOrEqual(0);
      expect(d.textureLean).toBeLessThanOrEqual(1);
    }
  });

  it('night sinks the register band', () => {
    const day = resolveMacroDrift(777, 1000, 1);
    const night = resolveMacroDrift(777, 1000, 0);
    expect(night.registerShift).toBeLessThan(day.registerShift);
  });
});
