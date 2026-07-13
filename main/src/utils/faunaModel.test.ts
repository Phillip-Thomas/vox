import { describe, expect, it } from 'vitest';
import {
  FAUNA_JOINTS,
  FAUNA_JOINT_ID,
  FAUNA_KINDS,
  FAUNA_KIND_ID,
  FAUNA_MATERIAL_SLOTS,
  FAUNA_MATERIAL_SLOT_ID,
  FAUNA_MODEL_SCHEMA_VERSION,
  FAUNA_REGIONS,
  FAUNA_REGION_ID,
  FAUNA_SPACE_CONVENTION,
  FAUNA_SPECIES,
  buildFaunaMorphologyTable,
  buildFaunaPhenotype,
  clampFaunaPose,
  emptyFaunaPose,
  normalizeFaunaLocomotionPhase
} from './faunaModel';

describe('fauna model contract', () => {
  it('keeps append-only semantic ids unique and aligned with registries', () => {
    expect(FAUNA_MODEL_SCHEMA_VERSION).toBe(1);
    expect(FAUNA_KINDS.map(kind => FAUNA_KIND_ID[kind])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(new Set(Object.values(FAUNA_KIND_ID)).size).toBe(FAUNA_KINDS.length);
    expect(FAUNA_REGIONS.map(region => FAUNA_REGION_ID[region])).toEqual(FAUNA_REGIONS.map((_, index) => index));
    expect(FAUNA_JOINTS.map(joint => FAUNA_JOINT_ID[joint])).toEqual(FAUNA_JOINTS.map((_, index) => index));
    expect(FAUNA_MATERIAL_SLOTS.map(slot => FAUNA_MATERIAL_SLOT_ID[slot])).toEqual(
      FAUNA_MATERIAL_SLOTS.map((_, index) => index)
    );
    for (const kind of FAUNA_KINDS) expect(FAUNA_SPECIES[kind].stableId).toBe(FAUNA_KIND_ID[kind]);
    expect(FAUNA_SPACE_CONVENTION).toMatchObject({
      handedness: 'right',
      upAxis: '+y',
      localForwardAxis: '+x',
      quaternionOrder: 'xyzw'
    });
    expect(Object.isFrozen(FAUNA_KINDS)).toBe(true);
    expect(Object.isFrozen(FAUNA_KIND_ID)).toBe(true);
    expect(Object.isFrozen(FAUNA_SPECIES)).toBe(true);
    expect(Object.isFrozen(FAUNA_SPECIES.grazer.regions)).toBe(true);
  });

  it('builds deterministic, bounded, planet-diverse phenotypes', () => {
    for (const kind of FAUNA_KINDS) {
      const a = buildFaunaPhenotype(12345, kind);
      const b = buildFaunaPhenotype(12345, kind);
      const c = buildFaunaPhenotype(54321, kind);
      expect(a).toEqual(b);
      expect(a.morphologyId).not.toBe(c.morphologyId);
      expect(a.mass).toBeGreaterThan(0);
      expect(a.bodyLength).toBeGreaterThan(0);
      expect(a.bodyWidth).toBeGreaterThan(0);
      expect(a.earSplay).toBeGreaterThanOrEqual(0);
      expect(a.earSplay).toBeLessThanOrEqual(1);
      expect(a.tailLift).toBeGreaterThanOrEqual(0);
      expect(a.tailLift).toBeLessThanOrEqual(1);
      expect(Object.isFrozen(a)).toBe(true);
    }
  });

  it('serializes a self-contained, shared morphology table without renderer objects', () => {
    const table = buildFaunaMorphologyTable(12345);
    const roundTrip = JSON.parse(JSON.stringify(table)) as typeof table;
    expect(table).toHaveLength(FAUNA_KINDS.length);
    expect(roundTrip.map(entry => entry.kind)).toEqual(FAUNA_KINDS);
    for (const entry of roundTrip) {
      expect(entry.schemaVersion).toBe(FAUNA_MODEL_SCHEMA_VERSION);
      expect(entry.kindId).toBe(FAUNA_KIND_ID[entry.kind]);
      expect(entry.morphologyId).toBe(entry.phenotype.morphologyId);
    }
  });

  it('normalizes renderer locomotion phases to cycles', () => {
    expect(normalizeFaunaLocomotionPhase(0)).toBe(0);
    expect(normalizeFaunaLocomotionPhase(1.25)).toBeCloseTo(0.25);
    expect(normalizeFaunaLocomotionPhase(-0.25)).toBeCloseTo(0.75);
    expect(normalizeFaunaLocomotionPhase(Number.NaN)).toBe(0);
  });

  it('keeps pose channels finite and bounded for backend adapters', () => {
    expect(emptyFaunaPose()).toEqual({
      locomotion: 0,
      graze: 0,
      alert: 0,
      flee: 0,
      hop: 0,
      swim: 0,
      wingbeat: 0,
      turn: 0,
      breathe: 0
    });
    const pose = clampFaunaPose({
      locomotion: 2,
      graze: -2,
      alert: Number.NaN,
      flee: 0.4,
      hop: 0.6,
      swim: 0.8,
      wingbeat: 0.2,
      turn: -0.4,
      breathe: Infinity
    });
    expect(pose.locomotion).toBe(1);
    expect(pose.graze).toBe(-1);
    expect(pose.alert).toBe(0);
    expect(pose.breathe).toBe(0);
  });
});
