import { chromium } from 'playwright-core';

const EXE = 'C:/Users/Phillip/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe';
const url = process.argv[2] || 'http://localhost:5173/?world=0,0&bench=1';

const browser = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('PAGEERR', e.message));
try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
catch (e) { console.log('goto warn:', e.message); }
await new Promise(r => setTimeout(r, 9000));

const report = await page.evaluate(async () => {
  const h = window.__three;
  if (!h) return { error: 'no __three' };
  const { gl, scene, camera } = h;
  const THREE = h.gl.constructor ? null : null;

  // Big offscreen target so fragment/overdraw cost is real (not a tiny buffer).
  const W = 1600, Hh = 900;
  const RT = gl.getContext ? null : null;
  // Use three from the scene's object constructors.
  const Three = scene.constructor.name === 'Scene' ? Object.getPrototypeOf(scene).constructor : null;

  const groups = {};
  let leafMesh = null;
  scene.traverse(o => {
    if (o.isInstancedMesh) {
      const k = (()=>{try{return o.material?.customProgramCacheKey?.();}catch{return o.material?.type;}})() || o.material?.type;
      (groups[k]=groups[k]||[]).push(o);
      if (/tree-leaf/.test(k)) leafMesh = o;
    }
  });
  if (!leafMesh) return { error: 'no leaf', groups: Object.keys(groups) };

  // Place camera AT the canopy center of instance 0 (point-blank -> full-screen overdraw).
  const m = leafMesh.instanceMatrix.array;
  const tx=m[12], ty=m[13], tz=m[14];
  const L=Math.hypot(tx,ty,tz)||1; const nx=tx/L,ny=ty/L,nz=tz/L;
  // a couple units up the canopy, looking tangentially across it
  camera.position.set(tx + nx*3, ty + ny*3, tz + nz*3);
  camera.lookAt(tx - nx, ty - ny, tz - nz); // look back through the canopy/planet
  if ('aspect' in camera) { camera.aspect = W/Hh; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld(true);

  // Force a large drawing buffer.
  gl.setSize(W, Hh, false);
  gl.setViewport(0,0,W,Hh);

  const time = (n) => { for(let i=0;i<4;i++) gl.render(scene,camera); const t0=performance.now(); for(let i=0;i<n;i++) gl.render(scene,camera); return (performance.now()-t0)/n; };
  const N = 20;
  const baseline = time(N);
  const visTris = gl.info.render.triangles, visCalls = gl.info.render.calls;

  const cost = {};
  for (const [k, meshes] of Object.entries(groups)) {
    meshes.forEach(x=>x.visible=false);
    const without = time(N);
    meshes.forEach(x=>x.visible=true);
    cost[k] = +(baseline - without).toFixed(2);
  }
  return {
    bufferSize: [W,Hh],
    visibleTris: visTris, visibleCalls: visCalls,
    baselineMsPerFrame: +baseline.toFixed(2),
    perGroupCost_ms: cost
  };
});
console.log(JSON.stringify(report, null, 2));
await browser.close();
