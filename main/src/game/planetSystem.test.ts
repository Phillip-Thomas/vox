import { describe, it, expect } from 'vitest';
import { MaterialType, MATERIAL_ORDER } from '../types/materials.ts';
import { coordinateToSeed } from '../utils/worldCoordinates.ts';
import { RESOURCES, ALL_RESOURCE_IDS, type ResourceId } from './data/resources.ts';
import { BLOCKS, ALL_BLOCK_IDS, CANONICAL_BLOCK_FOR_MATERIAL } from './data/blocks.ts';
import { BIOMES, ALL_BIOME_IDS } from './data/biomes.ts';
import { PLANET_ARCHETYPES, ALL_ARCHETYPE_IDS, type ArchetypeId } from './data/planetArchetypes.ts';
import { blockToRenderMaterial, materialToLegacyBlock } from './adapters.ts';
import {
  TIDEGARDEN_PROFILE_ID,
  TIDEGARDEN_PROFILE_VERSION,
  TIDEGARDEN_SEED,
  TIDEGARDEN_WORLD_ID,
  buildPlanetProfile,
  createPlanetProfileHash,
  resolvePlanetProfile
} from './PlanetProfile.ts';
import { GENERATION_SCHEMA_VERSION } from './schema.ts';
import { createPlanetIdentity } from './starSystem.ts';
import { hasVoxelShaderDetail } from '../utils/voxelMaterial.ts';
import { buildPlanetManifest } from './generation/buildPlanetManifest.ts';
import { resourceCanOccurOnProfile } from './generation/resourceDeposits.ts';
import { scanPlanet } from './systems/scannerSystem.ts';

const VALID_MATERIALS = new Set<string>(Object.values(MaterialType));
const VALID_RESOURCES = new Set<string>(ALL_RESOURCE_IDS);
const VALID_BIOMES = new Set<string>(ALL_BIOME_IDS);
const VALID_ARCHETYPES = new Set<string>(ALL_ARCHETYPE_IDS);
const VALID_BLOCKS = new Set<string>(ALL_BLOCK_IDS);

// A representative sample of planets across the galaxy grid.
function sampleSeeds(n = 600): number[] {
  const seeds: number[] = [];
  const span = Math.ceil(Math.sqrt(n) / 2);
  for (let x = -span; x <= span && seeds.length < n; x++) {
    for (let y = -span; y <= span && seeds.length < n; y++) {
      seeds.push(coordinateToSeed(x, y));
    }
  }
  return seeds;
}

describe('data integrity', () => {
  it('every block renders to a real MaterialType and drops real resources', () => {
    for (const id of ALL_BLOCK_IDS) {
      const b = BLOCKS[id];
      expect(VALID_MATERIALS.has(b.renderMaterial)).toBe(true);
      for (const d of b.drops) expect(VALID_RESOURCES.has(d)).toBe(true);
    }
  });

  it('canonical material→block map covers every MaterialType in MATERIAL_ORDER', () => {
    for (const m of MATERIAL_ORDER) {
      const block = CANONICAL_BLOCK_FOR_MATERIAL[m];
      expect(block, `no canonical block for ${m}`).toBeDefined();
      expect(BLOCKS[block].renderMaterial).toBe(m);
    }
  });

  it('every render material has authored voxel shader detail', () => {
    for (const material of MATERIAL_ORDER) {
      expect(hasVoxelShaderDetail(material), `${material} missing voxel detail`).toBe(true);
    }
  });

  it('resource affinities reference real biomes/archetypes', () => {
    for (const id of ALL_RESOURCE_IDS) {
      const r = RESOURCES[id];
      for (const b of Object.keys(r.biomeAffinity ?? {})) expect(VALID_BIOMES.has(b)).toBe(true);
      for (const a of Object.keys(r.archetypeAffinity ?? {})) expect(VALID_ARCHETYPES.has(a)).toBe(true);
    }
  });

  it('biomes reference real blocks/resources', () => {
    for (const id of ALL_BIOME_IDS) {
      const bi = BIOMES[id];
      for (const blk of bi.surfaceBlocks) expect(VALID_BLOCKS.has(blk)).toBe(true);
      for (const r of Object.keys(bi.resourceModifiers ?? {})) expect(VALID_RESOURCES.has(r)).toBe(true);
    }
  });

  it('archetypes reference real biomes/resources', () => {
    for (const id of ALL_ARCHETYPE_IDS) {
      const a = PLANET_ARCHETYPES[id];
      for (const b of Object.keys(a.biomeWeights)) expect(VALID_BIOMES.has(b)).toBe(true);
      for (const r of Object.keys(a.resourceBias ?? {})) expect(VALID_RESOURCES.has(r)).toBe(true);
    }
  });
});

describe('adapters round-trip', () => {
  it('material → canonical block → material is identity', () => {
    for (const m of MATERIAL_ORDER) {
      const block = materialToLegacyBlock(m);
      expect(blockToRenderMaterial(block)).toBe(m);
    }
  });
});

describe('PlanetProfile determinism', () => {
  it('same seed yields a byte-identical profile', () => {
    for (const seed of sampleSeeds(30)) {
      expect(buildPlanetProfile(seed)).toEqual(buildPlanetProfile(seed));
    }
  });

  it('stamps the current schema version', () => {
    expect(buildPlanetProfile(coordinateToSeed(0, 0)).schemaVersion).toBe(GENERATION_SCHEMA_VERSION);
  });

  it('biome weights are normalized (~1) for every planet', () => {
    for (const seed of sampleSeeds(200)) {
      const total = Object.values(buildPlanetProfile(seed).biomeWeights).reduce((s, w) => s + (w ?? 0), 0);
      expect(total).toBeGreaterThan(0.999);
      expect(total).toBeLessThan(1.001);
    }
  });
});

describe('canonical planet profile resolution', () => {
  it('leaves the high-bit origin profile on the unchanged procedural path', () => {
    const origin = createPlanetIdentity({ system: { x: -1, y: -1 }, slot: 0 });
    expect(origin.seed).toBe(3215739679);

    const resolved = resolvePlanetProfile({ worldId: origin.worldId, seed: origin.seed });
    expect(resolved.profileId).toBe('procedural');
    expect(resolved.thermalBehavior).toBe('standard');
    expect(resolved.identitySeed).toBe(origin.seed);
    expect(resolved.profile).toEqual(buildPlanetProfile(origin.seed));
  });

  it('pins only canonical p1 to deterministic Tidegarden v1 generation truth', () => {
    const sibling = createPlanetIdentity({ system: { x: -1, y: -1 }, slot: 1 });
    expect(sibling.worldId).toBe(TIDEGARDEN_WORLD_ID);
    expect(sibling.seed).toBe(TIDEGARDEN_SEED);
    expect(buildPlanetProfile(sibling.seed).archetype).toBe('volcanic');

    const first = resolvePlanetProfile({ worldId: sibling.worldId, seed: sibling.seed });
    const second = resolvePlanetProfile({ worldId: sibling.worldId, seed: sibling.seed });
    expect(first).toEqual(second);
    expect(first.profileId).toBe(TIDEGARDEN_PROFILE_ID);
    expect(first.profileVersion).toBe(TIDEGARDEN_PROFILE_VERSION);
    expect(first.thermalBehavior).toBe('nonlethal');
    expect(first.profile).toMatchObject({
      archetype: 'verdant',
      archetypeName: 'Tidegarden v1',
      terrainProfile: 'hills',
      hazards: ['none'],
      biome: {
        kind: 'alien',
        lushness: 0.75,
        aridity: 0.2,
        temperature: 0.56,
        hue: 0.5,
        grassHue: 0.4,
        leafHue: 0.6,
        saturation: 0.72,
        alien: true
      }
    });
    expect(first.profile.resourceBiases.stone).toBeGreaterThan(1);
    expect(first.profile.resourceBiases.resin).toBeGreaterThan(1);
    expect(first.profile.resourceBiases.biofiber).toBeGreaterThan(1);
    expect(first.profile.resourceBiases.iron_trace).toBeGreaterThan(
      first.profile.resourceBiases.copper_ore ?? 0
    );
    expect(first.profile.resourceBiases.frost_crystal).toBeUndefined();
  });

  it('permanently excludes p2 and seed-only callers from the Tidegarden pin', () => {
    const p2 = createPlanetIdentity({ system: { x: -1, y: -1 }, slot: 2 });
    const resolvedP2 = resolvePlanetProfile({ worldId: p2.worldId, seed: p2.seed });
    const seedOnly = resolvePlanetProfile({ seed: TIDEGARDEN_SEED });

    expect(resolvedP2.profileId).toBe('procedural');
    expect(resolvedP2.profile.archetype).toBe('arid');
    expect(seedOnly.profileId).toBe('procedural');
    expect(seedOnly.profile.archetype).toBe('volcanic');
    expect(resolvedP2.profileHash).not.toBe(seedOnly.profileHash);
  });

  it('rejects mismatched canonical identity and fingerprints version plus content', () => {
    const sibling = createPlanetIdentity({ system: { x: -1, y: -1 }, slot: 1 });
    expect(() => resolvePlanetProfile({
      worldId: sibling.worldId,
      seed: sibling.seed + 1
    })).toThrow(/does not match canonical world/);

    const resolved = resolvePlanetProfile({ worldId: sibling.worldId, seed: sibling.seed });
    const source = {
      worldId: resolved.worldId,
      identitySeed: resolved.identitySeed,
      profileId: resolved.profileId,
      profileVersion: resolved.profileVersion,
      thermalBehavior: resolved.thermalBehavior,
      profile: resolved.profile
    };
    expect(createPlanetProfileHash(source)).toBe(resolved.profileHash);
    expect(createPlanetProfileHash({
      ...source,
      profileVersion: source.profileVersion + 1
    })).not.toBe(resolved.profileHash);
    expect(createPlanetProfileHash({
      ...source,
      profile: {
        ...source.profile,
        biome: { ...source.profile.biome, lushness: source.profile.biome.lushness - 0.01 }
      }
    })).not.toBe(resolved.profileHash);
  });
});

describe('planet manifest and scanner', () => {
  it('manifest resources are possible on the source profile', () => {
    for (const seed of sampleSeeds(80)) {
      const profile = buildPlanetProfile(seed);
      const manifest = buildPlanetManifest(profile);
      const resources = [
        ...manifest.commonResources,
        ...manifest.rareResources,
        ...manifest.hiddenResources
      ];

      for (const resourceId of resources) {
        expect(resourceCanOccurOnProfile(profile, resourceId), `${resourceId} claimed for ${profile.archetype}`).toBe(true);
      }
    }
  });

  it('scanner level hides and reveals resources by resource scanLevel', () => {
    const profile = sampleSeeds(600)
      .map(buildPlanetProfile)
      .find(candidate => buildPlanetManifest(candidate).hiddenResources.length > 0);
    expect(profile).toBeDefined();

    const low = scanPlanet({ seed: profile!.seed, scanLevel: 0 });
    const high = scanPlanet({ seed: profile!.seed, scanLevel: 5 });

    for (const resourceId of [...low.commonResources, ...low.rareResources]) {
      expect(RESOURCES[resourceId].scanLevel).toBeLessThanOrEqual(0);
    }
    expect(low.hiddenResources.length).toBeGreaterThan(0);
    expect(high.hiddenResources).toEqual([]);
  });
});

describe('distribution / progression guarantees', () => {
  const profiles = sampleSeeds(600).map(buildPlanetProfile);

  it('every archetype appears, roughly in proportion to its weight', () => {
    const counts = new Map<ArchetypeId, number>();
    for (const p of profiles) counts.set(p.archetype, (counts.get(p.archetype) ?? 0) + 1);
    for (const id of ALL_ARCHETYPE_IDS) {
      expect(counts.get(id) ?? 0, `archetype ${id} never appeared`).toBeGreaterThan(0);
    }
    // The most common archetype should not dominate absurdly (weights are sane).
    const max = Math.max(...counts.values());
    expect(max).toBeLessThan(profiles.length * 0.5);
  });

  it('tier-0 resources are available on EVERY planet (critical path)', () => {
    const tier0: ResourceId[] = ALL_RESOURCE_IDS.filter(r => RESOURCES[r].tier === 0);
    for (const p of profiles) {
      for (const r of tier0) {
        expect((p.resourceBiases[r] ?? 0), `tier0 ${r} missing on a planet`).toBeGreaterThan(0);
      }
    }
  });

  it('each tier-1 resource is reachable on a healthy fraction of planets', () => {
    // Only vein-distributed resources (baseFrequency > 0). Some tier-1 resources
    // are byproducts, not veins — e.g. flint only drops from broken stone.
    const tier1: ResourceId[] = ALL_RESOURCE_IDS.filter(r => RESOURCES[r].tier === 1 && RESOURCES[r].baseFrequency > 0);
    for (const r of tier1) {
      const frac = profiles.filter(p => (p.resourceBiases[r] ?? 0) > 0).length / profiles.length;
      expect(frac, `tier1 ${r} too rare (${frac})`).toBeGreaterThan(0.4);
    }
  });

  it('the rarest resource (void_glass) is rare but not impossible', () => {
    const frac = profiles.filter(p => (p.resourceBiases.void_glass ?? 0) > 0).length / profiles.length;
    expect(frac).toBeGreaterThan(0);      // exists somewhere
    expect(frac).toBeLessThan(0.35);      // genuinely rare
  });

  it('no biome in any archetype mix references an undefined biome modifier path', () => {
    // Sanity: resourceBiases never produce NaN/Infinity.
    for (const p of profiles) {
      for (const v of Object.values(p.resourceBiases)) {
        expect(Number.isFinite(v as number)).toBe(true);
      }
    }
  });
});
