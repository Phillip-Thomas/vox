import { DEFAULT_TERRAIN_CONFIG, DEFAULT_WORLD_CONFIG, SEA_LEVEL_RADIUS_PERCENT, TerrainGenerationConfig, WorldGenerationConfig } from '../config/worldGeneration';
import { MaterialType } from '../types/materials';
import { buildPlanetProfile, type PlanetProfile } from '../game/PlanetProfile';
import type { ResourceId } from '../game/data/resources';

class SimpleNoise {
  private gradients = new Map<string, [number, number]>();

  constructor(private seed: number) {}

  fractalNoise(x: number, y: number, octaves = 4, persistence = 0.5, scale = 1) {
    let value = 0;
    let amplitude = 1;
    let frequency = scale;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return value / maxValue;
  }

  private noise(x: number, y: number) {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;
    const sx = x - x0;
    const sy = y - y0;

    const ix0 = this.interpolate(this.dotGrid(x0, y0, x, y), this.dotGrid(x1, y0, x, y), sx);
    const ix1 = this.interpolate(this.dotGrid(x0, y1, x, y), this.dotGrid(x1, y1, x, y), sx);
    return this.interpolate(ix0, ix1, sy);
  }

  private getGradient(x: number, y: number): [number, number] {
    const key = `${x},${y}`;
    const cached = this.gradients.get(key);
    if (cached) return cached;

    const angle = this.hashCoords(x, y) * Math.PI * 2;
    const gradient: [number, number] = [Math.cos(angle), Math.sin(angle)];
    this.gradients.set(key, gradient);
    return gradient;
  }

  private hashCoords(x: number, y: number) {
    let hash = Math.imul(x | 0, 374761393) ^
      Math.imul(y | 0, 668265263) ^
      Math.imul(this.seed | 0, 1274126177);
    hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  }

  private interpolate(a: number, b: number, t: number) {
    const fade = t * t * t * (t * (t * 6 - 15) + 10);
    return a + fade * (b - a);
  }

  private dotGrid(ix: number, iy: number, x: number, y: number) {
    const gradient = this.getGradient(ix, iy);
    return (x - ix) * gradient[0] + (y - iy) * gradient[1];
  }
}

export class ProceduralWorldGenerator {
  private config: WorldGenerationConfig;
  private terrainConfig: TerrainGenerationConfig;
  private noise: SimpleNoise;
  // Deterministic planet identity (archetype/biome mix/resource biases). The
  // generator consumes this so the SAME seed's archetype drives BOTH the surface
  // material skin and the ore distribution — see archetypeSurface + getOreMaterial.
  private profile: PlanetProfile;

  // Deep-ore resource -> render material. Only resources with a distinct ore
  // material appear as veins; others fall through to STONE.
  private static readonly ORE_MATERIAL: Partial<Record<ResourceId, MaterialType>> = {
    copper_ore: MaterialType.COPPER,
    gold_trace: MaterialType.GOLD,
    iron_trace: MaterialType.SILVER,
    charged_crystal: MaterialType.CRYSTAL,
    void_glass: MaterialType.CRYSTAL,
    basalt_glass: MaterialType.BASALT
  };
  private surfaceHeightCache = new Map<string, number>();
  private existenceCache = new Map<string, boolean>();
  // Lazily-computed sea-level radius (coordinate units) derived from a chosen
  // PERCENTILE of the actual terrain surface-radius distribution.
  private seaLevelRadius: number | null = null;
  // Lazily-computed flooded-water set (keys "x,y,z"): empty cells at/below the
  // waterline that are CONNECTED to the ocean surface (Minecraft-style flow into
  // voids). Replaces the old per-cell dominant-axis threshold.
  private floodedWater: Set<string> | null = null;
  // Minimum share of sampled terrain columns that must stay above the waterline,
  // so sea level can never submerge a whole planet (fixes "sea above ground").
  private static readonly MIN_LAND_FRACTION = 0.3;

  // The terrain only fills [-floor(R), floor(R)]^3, but some presets/seeds push
  // their surface a few voxels PAST the cube edge (a bulging planet). To still
  // float an ocean on those, the water scan + sea-level cap reach this many
  // shells beyond floor(R). Terrain rendering is unaffected (it never generates
  // past floor(R)); this only lets the ocean occupy the empty shells around the
  // terrain so EVERY seed can have a visible waterline.
  private static readonly WATER_SHELL_MARGIN = 5;

  // --- Surface material tuning knobs ----------------------------------------
  // The surface shell is SLOPE-DRIVEN (see generateMaterialForPosition): flat /
  // gentle ground is GRASS, moderate slopes are DIRT, steep faces & peaks are
  // STONE. `surfaceSlope` returns max(|du|,|dv|) of the terrain-top radius across
  // the two tangent axes (central differences over the cached surface-height
  // field), i.e. the local rise-over-run of the planet's surface. Tuned against
  // measured exposed-voxel distributions across seeds 12345/54321/13579.
  //
  // PEAK: terrainOffset above this is always STONE (rocky summits), independent
  //   of slope, so the highest land reads rocky.
  // STONE_SLOPE: slope at/above this is STONE (steep cliffs/scarps).
  // DIRT_SLOPE: slope at/above this (but below STONE_SLOPE) is DIRT (eroded
  //   hillsides / step walls). Below it is GRASS.
  // GRASS_DEPTH: the near-surface sub-layer with proceduralSurfaceHeight in
  //   (1, GRASS_DEPTH] is re-classified with the SAME slope rule, so GENTLE
  //   step-walls just under the skin read grassy instead of bare dirt, while
  //   STEEP walls (>= DIRT_SLOPE) still expose dirt/stone (no plastic green
  //   cliffs). Deeper than this stays DIRT.
  private static readonly PEAK = 5;
  private static readonly STONE_SLOPE = 0.68;
  private static readonly DIRT_SLOPE = 0.42;
  private static readonly GRASS_DEPTH = 3;

  constructor(config: WorldGenerationConfig = DEFAULT_WORLD_CONFIG, terrainConfig?: Partial<TerrainGenerationConfig>) {
    this.config = config;
    this.terrainConfig = { ...DEFAULT_TERRAIN_CONFIG, ...terrainConfig };
    this.noise = new SimpleNoise(this.terrainConfig.seed);
    this.profile = buildPlanetProfile(this.terrainConfig.seed);
  }

  /** The deterministic planet identity for this generator's seed. */
  getPlanetProfile(): PlanetProfile {
    return this.profile;
  }

  generateMaterialForPosition(x: number, y: number, z: number): MaterialType {
    if (!this.shouldVoxelExist(x, y, z)) return MaterialType.STONE;

    const distanceFromCenter = this.getDistanceFromCenter(x, y, z);
    const coreRadius = this.getCoreRadius();
    if (distanceFromCenter <= coreRadius) return MaterialType.LAVA;

    const proceduralSurfaceHeight = this.getProceduralSurfaceHeight(x, y, z);
    const planetRadius = this.getPlanetRadius();
    const baseDistance = Math.min(
      planetRadius - Math.abs(x),
      planetRadius - Math.abs(y),
      planetRadius - Math.abs(z)
    );
    const terrainOffset = proceduralSurfaceHeight - baseDistance;

    // SURFACE SHELL (the visible skin) and the near-surface GRASS-SKIN sub-layer
    // share a single SLOPE-DRIVEN rule: flat/gentle => GRASS, moderate => DIRT,
    // steep/peak => STONE, submerged => SAND. Re-classifying the sub-layer makes
    // gentle hillside step-walls read grassy while steep walls keep dirt/stone.
    if (
      (proceduralSurfaceHeight <= 1 && proceduralSurfaceHeight > 0) ||
      (proceduralSurfaceHeight > 1 && proceduralSurfaceHeight <= ProceduralWorldGenerator.GRASS_DEPTH)
    ) {
      return this.surfaceShellMaterial(x, y, z, terrainOffset, planetRadius);
    }

    if (proceduralSurfaceHeight <= 5) return MaterialType.DIRT;

    const depthRatio = (distanceFromCenter - coreRadius) / (planetRadius - coreRadius);
    if (depthRatio < 0.3) return this.getWeightedMaterial(x, y, z);
    if (depthRatio < 0.7) return this.coordinateRandom(x, y, z, 31) < 0.7 ? MaterialType.STONE : MaterialType.DIRT;
    return this.coordinateRandom(x, y, z, 43) < 0.8 ? MaterialType.STONE : MaterialType.DIRT;
  }

  /**
   * Slope-driven material for a surface-shell (or grass-skin) voxel.
   *   SAND  if the column's terrain top is at/below sea level (coast/seabed) —
   *         checked FIRST so coastlines & water stay correct.
   *   STONE if terrainOffset > PEAK (summits) OR slope >= STONE_SLOPE (cliffs).
   *   DIRT  if slope >= DIRT_SLOPE (moderate hillsides / step walls).
   *   GRASS otherwise (flat + gentle slopes — the genuine majority).
   */
  private surfaceShellMaterial(x: number, y: number, z: number, terrainOffset: number, planetRadius: number): MaterialType {
    const terrainTopRadius = planetRadius + terrainOffset;
    let base: MaterialType;
    if (terrainTopRadius <= this.getSeaLevelRadius()) {
      base = MaterialType.SAND;
    } else {
      const slope = this.surfaceSlope(x, y, z);
      if (terrainOffset > ProceduralWorldGenerator.PEAK || slope >= ProceduralWorldGenerator.STONE_SLOPE) {
        base = MaterialType.STONE;
      } else if (slope >= ProceduralWorldGenerator.DIRT_SLOPE) {
        base = MaterialType.DIRT;
      } else {
        base = MaterialType.GRASS;
      }
    }
    return this.archetypeSurface(base, x, y, z);
  }

  /**
   * Restyle the slope-derived surface material by the planet's ARCHETYPE so each
   * world reads distinctly (desert sand, volcanic basalt+lava, frozen ice, crystal
   * fields, metallic rock). Coastline SAND is preserved (water stays correct), and
   * temperate/verdant/oceanic/fungal keep the approved grass/dirt/stone look.
   * Because grass + trees only spawn on GRASS voxels, swapping the ground material
   * AUTOMATICALLY removes vegetation on non-verdant worlds (free cohesion).
   */
  private archetypeSurface(base: MaterialType, x: number, y: number, z: number): MaterialType {
    if (base === MaterialType.SAND) return base; // never restyle coast/seabed
    const ground = base === MaterialType.GRASS || base === MaterialType.DIRT;

    switch (this.profile.archetype) {
      case 'arid':
        return ground ? MaterialType.SAND : base;
      case 'volcanic':
        if (base === MaterialType.STONE) return MaterialType.BASALT;
        if (ground) {
          return this.coordinateRandom(x, y, z, 71) < 0.05 ? MaterialType.LAVA : MaterialType.BASALT;
        }
        return base;
      case 'frozen':
        return MaterialType.ICE; // ice sheet over the whole landmass (coast SAND kept above)
      case 'crystal':
        if (base === MaterialType.GRASS) {
          return this.coordinateRandom(x, y, z, 73) < 0.18 ? MaterialType.CRYSTAL : MaterialType.STONE;
        }
        return base === MaterialType.DIRT ? MaterialType.STONE : base;
      case 'metallic':
        return ground ? MaterialType.STONE : base;
      default:
        return base; // verdant / oceanic / fungal: keep grass/dirt/stone
    }
  }

  /**
   * Local terrain steepness at (x,y,z): the magnitude of the surface-top
   * gradient across the two TANGENT axes (the non-dominant ones, matching
   * getProceduralSurfaceHeight's dominant-axis selection). We sample the cached
   * surface-height field at the +/-1 tangent neighbours and take the central
   * difference per axis, then return max(|du|,|dv|) — the steepest of the two
   * tangent directions (chosen over the Euclidean magnitude so a single steep
   * direction, e.g. a scarp, reads as steep). Caches make this ~free.
   */
  private surfaceSlope(x: number, y: number, z: number): number {
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const absZ = Math.abs(z);

    // Tangent unit steps depend on which axis is dominant (mirrors
    // getProceduralSurfaceHeight's u/v choice).
    let du1: [number, number, number], du2: [number, number, number];
    let dv1: [number, number, number], dv2: [number, number, number];
    if (absX >= absY && absX >= absZ) {
      // dominant x => tangents are y (u) and z (v)
      du1 = [0, 1, 0]; du2 = [0, -1, 0];
      dv1 = [0, 0, 1]; dv2 = [0, 0, -1];
    } else if (absY >= absX && absY >= absZ) {
      // dominant y => tangents are x (u) and z (v)
      du1 = [1, 0, 0]; du2 = [-1, 0, 0];
      dv1 = [0, 0, 1]; dv2 = [0, 0, -1];
    } else {
      // dominant z => tangents are x (u) and y (v)
      du1 = [1, 0, 0]; du2 = [-1, 0, 0];
      dv1 = [0, 1, 0]; dv2 = [0, -1, 0];
    }

    const hUp = this.getProceduralSurfaceHeight(x + du1[0], y + du1[1], z + du1[2]);
    const hUm = this.getProceduralSurfaceHeight(x + du2[0], y + du2[1], z + du2[2]);
    const hVp = this.getProceduralSurfaceHeight(x + dv1[0], y + dv1[1], z + dv1[2]);
    const hVm = this.getProceduralSurfaceHeight(x + dv2[0], y + dv2[1], z + dv2[2]);

    const du = (hUp - hUm) / 2;
    const dv = (hVp - hVm) / 2;
    return Math.max(Math.abs(du), Math.abs(dv));
  }

  getAllVoxelPositions() {
    const positions: Array<{ x: number; y: number; z: number }> = [];
    const planetRadius = Math.floor(this.getPlanetRadius());

    for (let x = -planetRadius; x <= planetRadius; x++) {
      for (let y = -planetRadius; y <= planetRadius; y++) {
        for (let z = -planetRadius; z <= planetRadius; z++) {
          if (this.shouldVoxelExist(x, y, z)) {
            positions.push({ x, y, z });
          }
        }
      }
    }

    return positions;
  }

  // --- Water (Phase 4 rearchitecture) ---------------------------------------
  //
  // A position (x,y,z) is WATER iff it is empty (`!shouldVoxelExist`) AND sits
  // at or below sea level (cube-sphere dominant-axis radius `max(|x|,|y|,|z|) <=
  // seaLevelRadius`) — an air pocket flooded by the ocean. Above sea level the
  // same empty position is plain AIR.
  //
  // We only render EXPOSED water: a water voxel with >= 1 face-neighbour that is
  // AIR (the visible ocean surface plus any air-facing coastal sides). Interior
  // water (every neighbour water or solid) is culled, keeping the rendered set
  // bounded like the terrain surface. `isTopSurface` marks voxels whose OUTWARD
  // neighbour (one step further from center along the dominant axis) is air —
  // i.e. the true top of the ocean, useful for the shader to ripple only the top.

  /** Public: is this empty cell flooded (connected to the ocean, at/below sea level)? */
  isWaterVoxel(x: number, y: number, z: number): boolean {
    return this.getFloodedWater().has(`${x},${y},${z}`);
  }

  /** Public: is this empty cell open air (empty and not flooded)? */
  isAirVoxel(x: number, y: number, z: number): boolean {
    if (this.shouldVoxelExist(x, y, z)) return false;
    return !this.getFloodedWater().has(`${x},${y},${z}`);
  }

  /**
   * Flood fill (cached): every empty cell at/below the waterline that is
   * CONNECTED — through other empty sub-waterline cells — to the ocean surface
   * (a fillable cell touching open air above the line, or the scan boundary).
   * This is the Minecraft *result*: water flows DOWN into connected voids, caves
   * and depressions and stops at the waterline, gap-free; sealed pockets with no
   * path to the surface stay dry. Compares the DOMINANT-AXIS radius (max|x|,|y|,
   * |z|) — the same metric the cube-sphere terrain uses — so water aligns with
   * the land; connectivity (not a smooth sphere) is what fixes unfilled voids.
   * Computed once per generator.
   */
  private getFloodedWater(): Set<string> {
    if (this.floodedWater !== null) return this.floodedWater;
    const sea = this.getSeaLevelRadius();
    const R = this.waterScanRadius();
    const flooded = new Set<string>();
    const stack: Array<[number, number, number]> = [];

    const fillable = (x: number, y: number, z: number) =>
      !this.shouldVoxelExist(x, y, z) && this.dominantAxisRadius(x, y, z) <= sea;
    // Open air = anything outside the scan box (open space) OR an empty cell above
    // the waterline. A fillable cell next to open air is the ocean surface.
    const openAir = (x: number, y: number, z: number) =>
      Math.abs(x) > R || Math.abs(y) > R || Math.abs(z) > R
        ? true
        : !this.shouldVoxelExist(x, y, z) && this.dominantAxisRadius(x, y, z) > sea;

    const neigh: Array<[number, number, number]> = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
    ];

    // Seed from the ocean surface: fillable cells with an open-air neighbour.
    for (let x = -R; x <= R; x++) {
      for (let y = -R; y <= R; y++) {
        for (let z = -R; z <= R; z++) {
          if (!fillable(x, y, z)) continue;
          let surface = false;
          for (const [dx, dy, dz] of neigh) {
            if (openAir(x + dx, y + dy, z + dz)) { surface = true; break; }
          }
          if (!surface) continue;
          const key = `${x},${y},${z}`;
          if (!flooded.has(key)) { flooded.add(key); stack.push([x, y, z]); }
        }
      }
    }

    // Flood through connected fillable cells (flows down into voids/caves).
    while (stack.length) {
      const [x, y, z] = stack.pop()!;
      for (const [dx, dy, dz] of neigh) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (Math.abs(nx) > R || Math.abs(ny) > R || Math.abs(nz) > R) continue;
        const key = `${nx},${ny},${nz}`;
        if (flooded.has(key) || !fillable(nx, ny, nz)) continue;
        flooded.add(key);
        stack.push([nx, ny, nz]);
      }
    }

    this.floodedWater = flooded;
    return flooded;
  }

  /**
   * Scan the full [-R,R]^3 cube and return the exposed water-surface voxels.
   * Deterministic; mirrors getAllVoxelPositions' cost (one cube scan).
   */
  getExposedWaterVoxels(): Array<{ x: number; y: number; z: number; isTopSurface: boolean }> {
    const out: Array<{ x: number; y: number; z: number; isTopSurface: boolean }> = [];
    const scanRadius = this.waterScanRadius();

    for (let x = -scanRadius; x <= scanRadius; x++) {
      for (let y = -scanRadius; y <= scanRadius; y++) {
        for (let z = -scanRadius; z <= scanRadius; z++) {
          if (!this.isWaterVoxel(x, y, z)) continue;

          const neighbors: Array<[number, number, number]> = [
            [x + 1, y, z], [x - 1, y, z],
            [x, y + 1, z], [x, y - 1, z],
            [x, y, z + 1], [x, y, z - 1]
          ];

          let exposed = false;
          for (const [nx, ny, nz] of neighbors) {
            if (this.isAirVoxel(nx, ny, nz)) { exposed = true; break; }
          }
          if (!exposed) continue;

          // Top surface = the outward neighbour (one step further out along the
          // dominant axis) is open air. That cell is the ocean surface.
          const absX = Math.abs(x), absY = Math.abs(y), absZ = Math.abs(z);
          let ox = x, oy = y, oz = z;
          if (absX >= absY && absX >= absZ) ox += Math.sign(x) || 1;
          else if (absY >= absX && absY >= absZ) oy += Math.sign(y) || 1;
          else oz += Math.sign(z) || 1;
          const isTopSurface = this.isAirVoxel(ox, oy, oz);

          out.push({ x, y, z, isTopSurface });
        }
      }
    }

    return out;
  }

  /**
   * Scan the cube and return one entry per EXPOSED water FACE: a water voxel
   * coordinate plus which of its 6 neighbours is air. This is the surface-quad
   * representation used by the renderer — instead of drawing a volumetric cube
   * per water voxel (which reads as a hollow glass box because you see through
   * to the interior back-faces), we draw one flat quad per air-facing face.
   *
   * `faceDir` is an index into FACE_OFFSETS / FACE_NORMAL_AXES:
   *   0 = +x, 1 = -x, 2 = +y, 3 = -y, 4 = +z, 5 = -z.
   *
   * Overwhelmingly these are the OUTWARD/top faces (the ocean sheet); coastal
   * side faces that touch air are also included. Bounded like the terrain
   * surface — interior water (no air neighbour) emits no faces.
   */
  getExposedWaterFaces(): Array<{ x: number; y: number; z: number; faceDir: number }> {
    const out: Array<{ x: number; y: number; z: number; faceDir: number }> = [];
    const scanRadius = this.waterScanRadius();

    // Neighbour offsets, ordered to match the faceDir indices above.
    const offsets: Array<[number, number, number]> = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];

    for (let x = -scanRadius; x <= scanRadius; x++) {
      for (let y = -scanRadius; y <= scanRadius; y++) {
        for (let z = -scanRadius; z <= scanRadius; z++) {
          if (!this.isWaterVoxel(x, y, z)) continue;
          for (let f = 0; f < 6; f++) {
            const [dx, dy, dz] = offsets[f];
            if (this.isAirVoxel(x + dx, y + dy, z + dz)) {
              out.push({ x, y, z, faceDir: f });
            }
          }
        }
      }
    }

    return out;
  }

  private dominantAxisRadius(x: number, y: number, z: number) {
    return Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  }

  // Public query: is there terrain at this voxel? (used by tools/tests + callers
  // that need existence without a material.)
  shouldVoxelExist(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`;
    const cached = this.existenceCache.get(key);
    if (cached !== undefined) return cached;

    const exists = this.getDistanceFromCenter(x, y, z) <= this.getCoreRadius() ||
      this.getProceduralSurfaceHeight(x, y, z) > 0;
    this.existenceCache.set(key, exists);
    return exists;
  }

  private getProceduralSurfaceHeight(x: number, y: number, z: number) {
    const key = `${x},${y},${z}`;
    const cached = this.surfaceHeightCache.get(key);
    if (cached !== undefined) return cached;

    const planetRadius = this.getPlanetRadius();
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const absZ = Math.abs(z);

    let surfaceDistance: number;
    let u: number;
    let v: number;

    if (absX >= absY && absX >= absZ) {
      surfaceDistance = planetRadius - absX;
      u = y;
      v = z;
    } else if (absY >= absX && absY >= absZ) {
      surfaceDistance = planetRadius - absY;
      u = x;
      v = z;
    } else {
      surfaceDistance = planetRadius - absZ;
      u = x;
      v = y;
    }

    const scale = this.terrainConfig.terrainScale;
    const seedOffset = this.terrainConfig.seed * 0.001;
    const noiseX = (u + seedOffset) * scale;
    const noiseY = (v + seedOffset) * scale;

    const mountainNoise = this.noise.fractalNoise(
      noiseX * this.terrainConfig.mountainFrequency,
      noiseY * this.terrainConfig.mountainFrequency,
      8,
      0.7
    );
    const hillNoise = this.noise.fractalNoise(
      noiseX * this.terrainConfig.hillFrequency,
      noiseY * this.terrainConfig.hillFrequency,
      6,
      0.6
    );
    const detailNoise = this.noise.fractalNoise(noiseX * 0.3, noiseY * 0.3, 4, 0.5);
    const valleyNoise = this.noise.fractalNoise(noiseX * 0.04, noiseY * 0.04, 3, 0.6);

    let terrainOffset = 0;
    terrainOffset += mountainNoise * this.terrainConfig.heightVariation * 1.5;
    terrainOffset += hillNoise * this.terrainConfig.heightVariation * 0.8;
    terrainOffset += detailNoise * this.terrainConfig.heightVariation * 0.4;

    if (valleyNoise < -0.1) {
      terrainOffset -= this.terrainConfig.valleyDepth * Math.abs(valleyNoise + 0.1) * 5;
    }

    const height = surfaceDistance + terrainOffset;
    this.surfaceHeightCache.set(key, height);
    return height;
  }

  private getDistanceFromCenter(x: number, y: number, z: number) {
    return Math.sqrt(x * x + y * y + z * z);
  }

  private getCoreRadius() {
    return this.config.planetRadius * this.config.coreRadiusPercent;
  }

  private getPlanetRadius() {
    return this.config.planetRadius;
  }

  // Outer shell the water scan reaches: terrain extent plus the bulge margin.
  private waterScanRadius() {
    return Math.floor(this.getPlanetRadius()) + ProceduralWorldGenerator.WATER_SHELL_MARGIN;
  }

  private applySeaLevelOffset(sea: number) {
    const offset = this.terrainConfig.seaLevelOffset ?? 0;
    if (offset === 0) return sea;
    return Math.min(Math.max(sea + offset, 0), this.waterScanRadius() + 0.001);
  }

  // --- Percentile-based sea level -------------------------------------------
  //
  // Sea-level radius in COORDINATE units, computed (and memoized) from a chosen
  // PERCENTILE of the planet's actual terrain surface-radius distribution.
  //
  // We sample the terrain top radius over a grid on each of the 6 cube faces
  // (terrain top radius along a column = planetRadius + terrainOffset, where
  // terrainOffset is the noise displacement evaluated AT the face). Sorting the
  // samples and picking the Nth percentile yields a waterline GUARANTEED to
  // flood ~that fraction of the surface — so every preset has visible water and
  // the amount varies purely by `seaLevelPercentile`. If the percentile is 0 we
  // fall back to the legacy fixed fraction (no flooding intent).
  getSeaLevelRadius(): number {
    if (this.seaLevelRadius !== null) return this.seaLevelRadius;

    const percentile = this.terrainConfig.seaLevelPercentile;
    if (!(percentile > 0)) {
      this.seaLevelRadius = this.applySeaLevelOffset(this.config.planetRadius * SEA_LEVEL_RADIUS_PERCENT);
      return this.seaLevelRadius;
    }

    // Sea level = the chosen PERCENTILE of the actual terrain top-radius
    // distribution. Because the water scan reaches WATER_SHELL_MARGIN shells
    // past the terrain, an empty cell exists just above every column's terrain
    // top, so setting the waterline at the Nth-percentile top reliably floods
    // ~N% of the columns (their tops sit at/below the line) while higher land
    // stays dry. This keeps the per-preset gradient (valleys >> mountains)
    // intact AND guarantees non-empty water for every preset/seed.
    const tops = this.sampleSurfaceRadii();
    tops.sort((a, b) => a - b);
    const idx = Math.min(
      tops.length - 1,
      Math.max(0, Math.floor(percentile * (tops.length - 1)))
    );
    // Sea level = the percentile-th terrain top. By construction ~`percentile`
    // of columns then sit at/below the waterline, so coverage tracks the target
    // percentile directly and the per-preset gradient is preserved.
    let sea = tops[idx];

    // Optional manual nudge (per-preset seaLevelOffset).
    sea = this.applySeaLevelOffset(sea);

    // LAND-FRACTION CLAMP (fixes "sea level above ground"): never let the
    // waterline rise above the point where MIN_LAND_FRACTION of columns stay dry.
    // tops is ascending, so the top at index (1 - landFraction) leaves that
    // fraction above it. This caps the percentile AND any offset over-flooding.
    const landIdx = Math.min(
      tops.length - 1,
      Math.max(0, Math.floor((1 - ProceduralWorldGenerator.MIN_LAND_FRACTION) * (tops.length - 1)))
    );
    sea = Math.min(sea, tops[landIdx]);

    // GUARANTEE water exists: a column with terrain top T only floods if there
    // is an empty integer shell ceil(T) <= sea. If the clamp/percentile landed
    // below every column's first empty shell (zero water), raise sea to the
    // smallest shell that floods at least one column (water existence wins by a
    // hair over the land clamp).
    const minFloodShell = Math.min(...tops.map(t => Math.floor(t) + 1));
    if (sea < minFloodShell) sea = minFloodShell + 0.001;

    // Cap at the RENDERED terrain shell. Terrain only generates within
    // [-floor(R), floor(R)] (getAllVoxelPositions), so any waterline above
    // floor(R) would float an ocean ABOVE the top land shell — exactly the "sea
    // level above ground" bug. Keeping sea <= floor(R) confines water to dips at
    // or below the surface, leaving the top land shells dry.
    sea = Math.min(sea, Math.floor(this.getPlanetRadius()));
    this.seaLevelRadius = sea;
    return this.seaLevelRadius;
  }

  /**
   * Sample the terrain top radius (planetRadius + terrainOffset) across a grid
   * on every cube face. Deterministic (noise only). Returns one radius per
   * sampled column; the distribution drives the sea-level percentile.
   */
  private sampleSurfaceRadii(): number[] {
    const planetRadius = this.getPlanetRadius();
    const R = Math.floor(planetRadius);
    // Keep the sample grid bounded regardless of planet size (~ STEP spacing).
    const step = Math.max(1, Math.floor((2 * R) / 24));
    const radii: number[] = [];

    // For each of the 6 faces, fix the dominant axis at +/-R and sweep the two
    // tangent axes. getProceduralSurfaceHeight returns surfaceDistance +
    // terrainOffset; on the face surfaceDistance = planetRadius - R ≈ 0, so the
    // returned value is the terrainOffset there, and the top radius = R + offset.
    const faces: Array<[number, number, number]> = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1]
    ];

    for (const [ax, ay, az] of faces) {
      for (let u = -R; u <= R; u += step) {
        for (let v = -R; v <= R; v += step) {
          let x: number, y: number, z: number;
          if (ax !== 0) { x = ax * R; y = u; z = v; }
          else if (ay !== 0) { x = u; y = ay * R; z = v; }
          else { x = u; y = v; z = az * R; }
          // surfaceHeight = surfaceDistance + terrainOffset, and on the face the
          // dominant axis abs is R so surfaceDistance = planetRadius - R. The
          // terrain top radius (matching the SAND classification in
          // generateMaterialForPosition) is planetRadius + terrainOffset.
          const surfaceHeight = this.getProceduralSurfaceHeight(x, y, z);
          const terrainOffset = surfaceHeight - (planetRadius - R);
          radii.push(planetRadius + terrainOffset);
        }
      }
    }

    return radii;
  }

  /**
   * Deep-ore material at a position, weighted by THIS PLANET's contextual resource
   * biases (PlanetProfile.resourceBiases) rather than a single global rarity. So a
   * metallic moon shows copper/iron/gold veins, a crystal world glows with charged
   * crystal, an anomaly hides void glass — and ores stay a minority of deep rock
   * (heavy STONE base). Same seed -> identical veins (coordinateRandom is salted).
   */
  private getWeightedMaterial(x: number, y: number, z: number): MaterialType {
    const ORE_SCALE = 8;          // how strongly resource bias converts to vein weight
    const STONE_BASE = 60;        // keeps ores a minority of deep rock
    const weights: Array<[MaterialType, number]> = [[MaterialType.STONE, STONE_BASE]];
    let total = STONE_BASE;

    for (const [rid, mat] of Object.entries(ProceduralWorldGenerator.ORE_MATERIAL)) {
      const bias = this.profile.resourceBiases[rid as ResourceId];
      if (!bias || bias <= 0) continue;
      const w = bias * ORE_SCALE;
      weights.push([mat as MaterialType, w]);
      total += w;
    }

    let random = this.coordinateRandom(x, y, z, 19) * total;
    for (const [mat, w] of weights) {
      random -= w;
      if (random <= 0) return mat;
    }
    return MaterialType.STONE;
  }

  private coordinateRandom(x: number, y: number, z: number, salt: number) {
    let hash = Math.imul(x | 0, 374761393) ^
      Math.imul(y | 0, 668265263) ^
      Math.imul(z | 0, 2147483647) ^
      Math.imul(this.terrainConfig.seed | 0, 1274126177) ^
      Math.imul(salt | 0, 1597334677);
    hash = Math.imul(hash ^ (hash >>> 15), 2246822519);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489917);
    hash ^= hash >>> 16;
    return (hash >>> 0) / 4294967296;
  }

}
