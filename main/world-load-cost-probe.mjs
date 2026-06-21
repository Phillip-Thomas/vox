import fs from 'node:fs';
import { chromium } from 'playwright-core';

const DEFAULT_EXES = [
  process.env.PLAYWRIGHT_CHROMIUM_EXE,
  'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
].filter(Boolean);

function safeExists(path) {
  try {
    return fs.existsSync(path);
  } catch {
    return false;
  }
}

const executablePath = DEFAULT_EXES.find(path => safeExists(path));
if (!executablePath) {
  console.error('No Chromium executable found. Set PLAYWRIGHT_CHROMIUM_EXE to a browser path.');
  process.exit(1);
}

const url = process.argv[2] || 'http://127.0.0.1:5178/';
const [destX = '1', destY = '0'] = (process.argv[3] || '1,0').split(',');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist'
  ]
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', error => console.log('PAGEERR', error.message));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

const report = await page.evaluate(async ([rawX, rawY]) => {
  const { createCurrentWorld } = await import('/src/utils/worldCoordinates.ts');
  const { getWorldGen, clearWorldGenCache } = await import('/src/utils/worldGenCache.ts');
  const { createWorldArrivalPose } = await import('/src/utils/worldArrival.ts');
  const { MATERIALS } = await import('/src/types/materials.ts');
  const { buildWaterFaces } = await import('/src/utils/waterVoxels.ts');
  const { buildTreeProfile, paramsFromProfile } = await import('/src/utils/treeProfile.ts');
  const { generateTree } = await import('/src/utils/treeGen.ts');
  const { EfficientVoxelSystem } = await import('/src/utils/efficientVoxelSystem.ts');

  const size = 50;
  const world = createCurrentWorld({ x: Number(rawX), y: Number(rawY) });
  const rows = [];

  function coordKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  function isVoxelExposedInTerrain(x, y, z, terrainPositions) {
    return (
      !terrainPositions.has(coordKey(x + 1, y, z)) ||
      !terrainPositions.has(coordKey(x - 1, y, z)) ||
      !terrainPositions.has(coordKey(x, y + 1, z)) ||
      !terrainPositions.has(coordKey(x, y - 1, z)) ||
      !terrainPositions.has(coordKey(x, y, z + 1)) ||
      !terrainPositions.has(coordKey(x, y, z - 1))
    );
  }

  function time(label, fn, detailsForResult = () => ({})) {
    const startedAt = performance.now();
    const result = fn();
    rows.push({
      label,
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      details: detailsForResult(result)
    });
    return result;
  }

  clearWorldGenCache();
  const coldWorldGen = time(
    'worldgen:cache_miss_build',
    () => getWorldGen(size, world.seed),
    result => ({ voxels: result.voxels.length })
  );

  time(
    'scene:arrival_pose_cached',
    () => createWorldArrivalPose(size, world.seed),
    pose => ({
      surfaceX: pose.surfaceVoxel.x,
      surfaceY: pose.surfaceVoxel.y,
      surfaceZ: pose.surfaceVoxel.z
    })
  );

  const originalTerrain = time(
    'planet:terrain_materialize',
    () => coldWorldGen.voxels.map(position => {
      const material = coldWorldGen.generator.generateMaterialForPosition(position.x, position.y, position.z);
      return {
        ...position,
        material,
        color: MATERIALS[material].color.clone()
      };
    }),
    result => ({ voxels: result.length })
  );

  const initialVoxels = time(
    'planet:exposed_filter',
    () => {
      const terrainPositions = new Set(originalTerrain.map(voxel => coordKey(voxel.x, voxel.y, voxel.z)));
      return originalTerrain.filter(voxel => isVoxelExposedInTerrain(voxel.x, voxel.y, voxel.z, terrainPositions));
    },
    result => ({ exposed: result.length, original: originalTerrain.length })
  );

  time(
    'planet:voxel_system_populate_fake_mesh',
    () => {
      const system = new EfficientVoxelSystem(1000);
      const mesh = {
        count: 0,
        instanceMatrix: { count: Math.max(originalTerrain.length, initialVoxels.length, 5000), needsUpdate: false },
        instanceColor: { needsUpdate: false },
        geometry: { setAttribute() {} },
        setMatrixAt() {},
        setColorAt() {},
        boundingBox: null,
        boundingSphere: null
      };
      system.reset();
      system.expandCapacity(mesh.instanceMatrix.count);
      system.setMesh(mesh);
      system.setOriginalTerrain(originalTerrain);
      for (const voxel of initialVoxels) {
        system.addVoxel(voxel.x, voxel.y, voxel.z, voxel.material, voxel.color);
      }
      return system.getStats();
    },
    stats => ({
      exposed: stats.exposedVoxels,
      activeSlots: stats.activeSlots,
      maxSlots: stats.maxSlots
    })
  );

  time(
    'water:faces_generate',
    () => buildWaterFaces(size, world.seed),
    result => ({ faces: result.length })
  );

  const profile = time(
    'tree:profile',
    () => buildTreeProfile(world.seed)
  );

  time(
    'tree:archetype_generate',
    () => generateTree(world.seed, paramsFromProfile(profile)),
    result => ({
      trunkVerts: result.trunkGeometry.attributes.position.count,
      leafVerts: result.leafGeometry.attributes.position.count,
      blossomVerts: result.blossomGeometry?.attributes.position.count ?? 0,
      impostorVerts: result.impostorGeometry.attributes.position.count
    })
  );

  return {
    coordinate: `${world.coordinate.x},${world.coordinate.y}`,
    seed: world.seed,
    rows: rows.sort((a, b) => b.durationMs - a.durationMs)
  };
}, [destX, destY]);

await browser.close();
console.log(JSON.stringify(report, null, 2));
