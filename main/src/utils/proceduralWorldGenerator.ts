import { DEFAULT_TERRAIN_CONFIG, DEFAULT_WORLD_CONFIG, SEA_LEVEL_RADIUS_PERCENT, TerrainGenerationConfig, WorldGenerationConfig } from '../config/worldGeneration';
import { MATERIALS, MaterialType } from '../types/materials';

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
  private surfaceHeightCache = new Map<string, number>();
  private existenceCache = new Map<string, boolean>();
  // Lazily-computed sea-level radius (coordinate units) derived from a chosen
  // PERCENTILE of the actual terrain surface-radius distribution.
  private seaLevelRadius: number | null = null;

  // The terrain only fills [-floor(R), floor(R)]^3, but some presets/seeds push
  // their surface a few voxels PAST the cube edge (a bulging planet). To still
  // float an ocean on those, the water scan + sea-level cap reach this many
  // shells beyond floor(R). Terrain rendering is unaffected (it never generates
  // past floor(R)); this only lets the ocean occupy the empty shells around the
  // terrain so EVERY seed can have a visible waterline.
  private static readonly WATER_SHELL_MARGIN = 5;

  constructor(config: WorldGenerationConfig = DEFAULT_WORLD_CONFIG, terrainConfig?: Partial<TerrainGenerationConfig>) {
    this.config = config;
    this.terrainConfig = { ...DEFAULT_TERRAIN_CONFIG, ...terrainConfig };
    this.noise = new SimpleNoise(this.terrainConfig.seed);
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

    if (proceduralSurfaceHeight <= 1 && proceduralSurfaceHeight > 0) {
      if (terrainOffset > 4) return MaterialType.STONE;
      if (terrainOffset < -3) return MaterialType.DIRT;
      // Coastline / seabed: a surface voxel whose terrain top sits at or below
      // sea level is shore or underwater ground, so it is SAND rather than
      // GRASS. The terrain top in coordinate units along this column's dominant
      // axis is (planetRadius + terrainOffset). No water voxel is placed here —
      // the ocean is the single transparent <WaterShell> at the same sea level.
      const terrainTopRadius = planetRadius + terrainOffset;
      if (terrainTopRadius <= this.getSeaLevelRadius()) return MaterialType.SAND;
      return MaterialType.GRASS;
    }

    if (proceduralSurfaceHeight <= 5) return MaterialType.DIRT;

    const depthRatio = (distanceFromCenter - coreRadius) / (planetRadius - coreRadius);
    if (depthRatio < 0.3) return this.getWeightedMaterial(x, y, z);
    if (depthRatio < 0.7) return this.coordinateRandom(x, y, z, 31) < 0.7 ? MaterialType.STONE : MaterialType.DIRT;
    return this.coordinateRandom(x, y, z, 43) < 0.8 ? MaterialType.STONE : MaterialType.DIRT;
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

  /** Public: is this empty cell flooded (at/below sea level)? */
  isWaterVoxel(x: number, y: number, z: number): boolean {
    if (this.shouldVoxelExist(x, y, z)) return false;
    return this.dominantAxisRadius(x, y, z) <= this.getSeaLevelRadius();
  }

  /** Public: is this empty cell open air (above sea level)? */
  isAirVoxel(x: number, y: number, z: number): boolean {
    if (this.shouldVoxelExist(x, y, z)) return false;
    return this.dominantAxisRadius(x, y, z) > this.getSeaLevelRadius();
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

  private shouldVoxelExist(x: number, y: number, z: number) {
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
      this.seaLevelRadius = this.config.planetRadius * SEA_LEVEL_RADIUS_PERCENT;
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

    // GUARANTEE water exists: a column with terrain top T only floods if there
    // is an empty integer shell ceil(T) <= sea. For very tight/high
    // distributions the chosen percentile can land just below every column's
    // first empty shell (zero water). If so, raise sea to the smallest shell
    // that floods at least one column, so every preset/seed keeps visible water.
    const minFloodShell = Math.min(...tops.map(t => Math.floor(t) + 1));
    if (sea < minFloodShell) sea = minFloodShell + 0.001;

    // Never exceed the outermost scannable shell.
    sea = Math.min(sea, this.waterScanRadius() + 0.001);
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

  private getWeightedMaterial(x: number, y: number, z: number) {
    const materialTypes = Object.values(MaterialType).filter(type => MATERIALS[type].rarity > 0);
    const totalWeight = materialTypes.reduce((sum, type) => sum + MATERIALS[type].rarity, 0);
    let random = this.coordinateRandom(x, y, z, 19) * totalWeight;

    for (const materialType of materialTypes) {
      random -= MATERIALS[materialType].rarity;
      if (random <= 0) return materialType;
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
