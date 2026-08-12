// D-A1 measurement probe: where does the ch10 flight "lens" divergence between
// the LOW strips and the HIGH hero stills come from?
//
// Method: four cold runs of ?story=ch10-transit&movie=1&profile=LOW. Each run
// flies at LOW (realtime) to the SAME gate (spaceFlight phase == 'deep_space'
// plus a fixed dwell), shoots a pre-raise reference frame, then raises to its
// target profile through the shipped setQualityProfile store, settles, samples
// and shoots again.
//
// At each sample we record the ACTUALLY-RENDERING camera (captured by hooking
// WebGLRenderer.prototype.render, so it is the camera three.js was handed, not
// a guess), the renderer size/pixel ratio, the canvas attrs vs CSS box, the
// ship flight feedback fov, and the cockpit rig's parentage, world scale,
// distance and projected canopy quad in device pixels.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const CAP_DIR = path.join(RUN_DIR, 'evidence', 'capture', 'lens-divergence');
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const OUT = path.join(OUT_DIR, 'ch10-lens-divergence.json');
const BASE = process.env.VOX_BASE ?? 'http://localhost:5176';
fs.mkdirSync(CAP_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

// ---------------------------------------------------------------- page hooks
const INSTALL = async () => {
  if (window.__voxLensHooked) return true;
  const src = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
  const threeUrl = src.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
  const THREE = await import(/* @vite-ignore */ threeUrl);
  window.__THREE = THREE;
  window.__voxRender = { count: 0, worldPasses: 0, passes: [] };
  // three's WebGLRenderer assigns `render` as an OWN property, so patching the
  // prototype is a no-op. WebGLRenderer.render calls
  // `scene.onBeforeRender(renderer, scene, camera, renderTarget)` for every
  // Scene pass, and Scene inherits that from Object3D, so shadowing it on
  // Scene.prototype gives the real (renderer, scene, camera) triple per pass.
  const baseOBR = THREE.Object3D.prototype.onBeforeRender;
  THREE.Scene.prototype.onBeforeRender = function (renderer, scene, camera, renderTarget) {
    const r = window.__voxRender;
    r.count += 1;
    const el = renderer?.domElement;
    const key = el ? `${el.width}x${el.height}` : 'none';
    r.byCanvas = r.byCanvas ?? {};
    const px = el ? el.width * el.height : 0;
    if (camera && camera.isPerspectiveCamera) {
      r.byCanvas[key] = { renderer, scene, camera, renderTarget: renderTarget ?? null, px,
        passes: (r.byCanvas[key]?.passes ?? 0) + 1 };
      r.worldPasses += 1;
      // The main game canvas is the largest-area drawing buffer.
      let best = null;
      for (const v of Object.values(r.byCanvas)) if (!best || v.px > best.px) best = v;
      r.renderer = best.renderer; r.scene = best.scene; r.camera = best.camera;
      r.mainKey = Object.keys(r.byCanvas).find(k => r.byCanvas[k] === best);
      r.canvasKeys = Object.keys(r.byCanvas);
      r.perCanvasPasses = Object.fromEntries(Object.entries(r.byCanvas)
        .map(([k, v]) => [k, { passes: v.passes, cameraUuid: v.camera.uuid, fov: v.camera.fov }]));
    }
    return baseOBR.call(this, renderer, scene, camera, renderTarget);
  };
  window.__voxLensHooked = true;
  return true;
};

const SAMPLE = async () => {
  const THREE = window.__THREE;
  const V3 = () => new THREE.Vector3();
  const out = { t: Date.now(), beat: window.__storyBeat ?? null };

  // --- runtime story / flight state -------------------------------------
  try {
    const g = await import('/src/config/graphicsSettings.ts');
    out.qualityProfile = g.getQualityProfile();
    const q = g.getGraphicsQuality();
    out.graphics = { postProcess: q.postProcess, bloom: q.bloom ?? null, shadows: q.shadows ?? null,
      renderScale: q.renderScale ?? null, maxPixelRatio: q.maxPixelRatio ?? null };
  } catch (e) { out.graphicsError = String(e).slice(0, 160); }
  try {
    const f = await import('/src/state/shipFlightFeedback.ts');
    out.shipFlightFeedback = { ...f.getShipFlightFeedback() };
    out.SHIP_BASE_FOV = f.SHIP_BASE_FOV;
  } catch (e) { out.flightFeedbackError = String(e).slice(0, 160); }
  try {
    const sf = await import('/src/state/spaceFlight.ts');
    const s = sf.getSpaceFlightSnapshot();
    out.spaceFlight = { phase: s.phase, controlMode: s.controlMode };
  } catch (e) { out.spaceFlightError = String(e).slice(0, 160); }
  try {
    const p = await import('/src/story/storyInputPolicy.ts');
    const pol = p.getStoryInputPolicy();
    out.storyPolicy = { targetFov: pol.targetFov ?? null, targetDpr: pol.targetDpr ?? null,
      feedBlend: pol.feedBlend ?? null };
  } catch (e) { out.storyPolicyError = String(e).slice(0, 160); }
  try {
    const av = await import('/src/story/signedSceneAvRuntime.ts');
    const s = av.getSignedSceneAvDebugSnapshot();
    out.av = { anchorId: s.anchorId, authority: s.shot?.cameraAuthority ?? null,
      appliedFovDeg: s.shot?.lens?.appliedFovDeg ?? null,
      history: s.activationHistoryAnchorIds ?? [] };
  } catch (e) { out.avError = String(e).slice(0, 160); }

  const hud = document.querySelector('[data-story-guidance-hud]');
  out.hudText = hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null;
  out.cockpitReadoutPresent = !!document.querySelector('[data-cockpit-readout]')
    || /VELOCITY/.test(document.body.innerText);

  // --- DOM / renderer sizing --------------------------------------------
  out.window = { devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth, innerHeight: window.innerHeight };
  const canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({
    attrWidth: c.width, attrHeight: c.height,
    clientWidth: c.clientWidth, clientHeight: c.clientHeight,
    cssWidth: c.style.width || null, cssHeight: c.style.height || null,
    rect: (() => { const r = c.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })()
  }));
  out.canvases = canvases;

  const R = window.__voxRender;
  out.renderPasses = { total: R?.count ?? 0, worldPasses: R?.worldPasses ?? 0,
    canvasKeys: R?.canvasKeys ?? null, mainCanvasKey: R?.mainKey ?? null,
    perCanvas: R?.perCanvasPasses ?? null };
  if (R?.renderer) {
    const size = R.renderer.getSize(new THREE.Vector2());
    const ds = R.renderer.getDrawingBufferSize
      ? R.renderer.getDrawingBufferSize(new THREE.Vector2()) : null;
    out.renderer = {
      glGetSize: [size.x, size.y],
      glPixelRatio: R.renderer.getPixelRatio(),
      drawingBufferSize: ds ? [ds.x, ds.y] : null,
      domElementWidth: R.renderer.domElement.width,
      domElementHeight: R.renderer.domElement.height,
      currentViewport: (() => { const v = new THREE.Vector4();
        R.renderer.getCurrentViewport(v); return [v.x, v.y, v.z, v.w]; })(),
      renderTargetActive: !!R.renderer.getRenderTarget()
    };
    const rt = R.renderer.getRenderTarget();
    if (rt) out.renderer.renderTargetSize = [rt.width, rt.height];
  }

  // --- the actually-rendering camera ------------------------------------
  const cam = R?.camera ?? null;
  if (cam) {
    const cp = V3(); cam.getWorldPosition(cp);
    const cq = new THREE.Quaternion(); cam.getWorldQuaternion(cq);
    const fwd = V3().set(0, 0, -1).applyQuaternion(cq);
    out.camera = {
      uuid: cam.uuid, name: cam.name || null, type: cam.type,
      fov: cam.fov, aspect: cam.aspect, near: cam.near, far: cam.far,
      zoom: cam.zoom, filmGauge: cam.filmGauge ?? null,
      worldPosition: [cp.x, cp.y, cp.z].map(n => Number(n.toFixed(3))),
      forward: [fwd.x, fwd.y, fwd.z].map(n => Number(n.toFixed(4))),
      parentChain: (() => { const names = []; let o = cam.parent;
        while (o) { names.push(o.name || o.type); o = o.parent; } return names; })(),
      childNames: cam.children.map(c => c.name || c.type),
      projectionHalfHeightTan: Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)
    };
  }

  // --- every camera in the rendered scene --------------------------------
  const scene = R?.scene ?? null;
  if (scene) {
    const cams = [];
    scene.traverse(o => {
      if (o.isCamera) {
        const wp = V3(); o.getWorldPosition(wp);
        cams.push({ uuid: o.uuid, name: o.name || null, type: o.type,
          fov: o.fov ?? null, visible: o.visible,
          isRenderCamera: cam ? o.uuid === cam.uuid : null,
          worldPosition: [wp.x, wp.y, wp.z].map(n => Number(n.toFixed(2))),
          childNames: o.children.map(c => c.name || c.type) });
      }
    });
    out.scenePerspectiveCameras = cams;
    out.renderCameraInScene = cam ? cams.some(c => c.uuid === cam.uuid) : null;

    // --- cockpit rig ------------------------------------------------------
    const findAnywhere = (name) => {
      let hit = null;
      scene.traverse(o => { if (!hit && o.name === name) hit = o; });
      if (hit) return hit;
      // The rig is a camera child; if that camera is not in the scene graph,
      // walk from the render camera and every scene camera too.
      const roots = [cam, ...(cams.map(c => null))].filter(Boolean);
      for (const root of roots) {
        root.traverse(o => { if (!hit && o.name === name) hit = o; });
        if (hit) return hit;
      }
      return null;
    };
    const describe = (obj) => {
      if (!obj) return null;
      obj.updateWorldMatrix(true, false);
      const pos = V3(), quat = new THREE.Quaternion(), scale = V3();
      obj.matrixWorld.decompose(pos, quat, scale);
      const camPos = cam ? (() => { const p = V3(); cam.getWorldPosition(p); return p; })() : null;
      const box = new THREE.Box3().setFromObject(obj);
      return {
        name: obj.name || obj.type, type: obj.type, visible: obj.visible,
        localScale: [obj.scale.x, obj.scale.y, obj.scale.z].map(n => Number(n.toFixed(5))),
        worldScale: [scale.x, scale.y, scale.z].map(n => Number(n.toFixed(5))),
        worldPosition: [pos.x, pos.y, pos.z].map(n => Number(n.toFixed(3))),
        distanceFromRenderCamera: camPos ? Number(pos.distanceTo(camPos).toFixed(3)) : null,
        parentChain: (() => { const names = []; let o = obj.parent;
          while (o) { names.push(o.name || o.type); o = o.parent; } return names; })(),
        worldBox: box.isEmpty() ? null : {
          min: [box.min.x, box.min.y, box.min.z].map(n => Number(n.toFixed(2))),
          max: [box.max.x, box.max.y, box.max.z].map(n => Number(n.toFixed(2))) }
      };
    };

    const cockpit = findAnywhere('ship-cockpit');
    const rig = findAnywhere('ship-cockpit-rig');
    const shell = findAnywhere('ship-cockpit-pressure-shell');
    const instruments = findAnywhere('ship-cockpit-instruments');
    out.cockpit = { root: describe(cockpit), rig: describe(rig),
      shell: describe(shell), instruments: describe(instruments) };
    out.cockpitInRenderedScene = (() => {
      if (!cockpit) return false;
      let o = cockpit; while (o.parent) o = o.parent;
      return o === scene;
    })();

    // --- projected canopy quad (the "aperture") in device pixels ----------
    if (shell && cam) {
      let canopy = null;
      shell.traverse(o => {
        const p = o.geometry?.parameters;
        if (!canopy && o.isMesh && p && Math.abs((p.width ?? 0) - 8.4) < 0.001) canopy = o;
      });
      // Fall back to the widest plane in the shell.
      if (!canopy) shell.traverse(o => {
        if (!canopy && o.isMesh && o.geometry?.type === 'PlaneGeometry') canopy = o;
      });
      if (canopy) {
        canopy.updateWorldMatrix(true, false);
        const p = canopy.geometry.parameters;
        const hw = (p.width ?? 8.4) / 2, hh = (p.height ?? 4.75) / 2;
        const w = out.renderer?.glGetSize?.[0] ?? window.innerWidth;
        const h = out.renderer?.glGetSize?.[1] ?? window.innerHeight;
        const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => {
          const v = V3().set(x, y, 0).applyMatrix4(canopy.matrixWorld).project(cam);
          return [Number((( v.x * 0.5 + 0.5) * w).toFixed(1)),
            Number(((-v.y * 0.5 + 0.5) * h).toFixed(1)), Number(v.z.toFixed(4))];
        });
        const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
        out.canopyProjection = {
          meshName: canopy.name || canopy.type,
          planeParams: [p.width ?? null, p.height ?? null],
          worldScale: (() => { const s = V3(); canopy.getWorldScale(s);
            return [s.x, s.y, s.z].map(n => Number(n.toFixed(5))); })(),
          distanceFromCamera: (() => { const wp = V3(); canopy.getWorldPosition(wp);
            const cp = V3(); cam.getWorldPosition(cp); return Number(wp.distanceTo(cp).toFixed(3)); })(),
          cornersPx: corners,
          widthPx: Number((Math.max(...xs) - Math.min(...xs)).toFixed(1)),
          heightPx: Number((Math.max(...ys) - Math.min(...ys)).toFixed(1)),
          screenSizeUsed: [w, h]
        };
      } else {
        out.canopyProjection = { error: 'no plane mesh found in pressure shell' };
      }
    }
  }
  return out;
};

const RAISE = async (profile) => {
  const g = await import('/src/config/graphicsSettings.ts');
  g.setQualityProfile(profile, { persist: false });
  return g.getQualityProfile();
};

const GATE = async () => {
  try {
    const sf = await import('/src/state/spaceFlight.ts');
    const s = sf.getSpaceFlightSnapshot();
    return { phase: s.phase, controlMode: s.controlMode, beat: window.__storyBeat ?? null };
  } catch { return { phase: null, controlMode: null, beat: window.__storyBeat ?? null }; }
};

// -------------------------------------------------------------------- driver
const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});

const report = {
  capturedAt: new Date().toISOString(), base: BASE,
  defect: 'D-A1: ch10 flight LOW strips appear to render at a different effective lens than the HIGH hero stills',
  method: 'four cold runs of ?story=ch10-transit&movie=1&profile=LOW; each flies at LOW to the same gate (spaceFlight.phase==deep_space + DWELL_MS), shoots a pre-raise reference, raises to its target profile via setQualityProfile(persist:false), settles, samples and shoots',
  gate: null, runs: []
};
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

const DWELL_MS = Number(process.env.VOX_DWELL ?? 25000);
const HIGH_SETTLE_MS = Number(process.env.VOX_HIGH_SETTLE ?? 45000);
const OTHER_SETTLE_MS = Number(process.env.VOX_SETTLE ?? 9000);
report.gate = { condition: "spaceFlight.phase === 'deep_space'", dwellMs: DWELL_MS,
  highSettleMs: HIGH_SETTLE_MS, otherSettleMs: OTHER_SETTLE_MS };

async function run(id, profile, opts) {
  const started = Date.now();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    reducedMotion: opts.reducedMotion ?? 'no-preference',
    deviceScaleFactor: opts.deviceScaleFactor ?? 1
  });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(`${BASE}/?story=ch10-transit&movie=1&profile=LOW`, { waitUntil: 'load', timeout: 120000 });
  await new Promise(r => setTimeout(r, 12000));
  await page.evaluate(INSTALL).catch(e => errs.push('hook ' + String(e).slice(0, 160)));

  // --- mid-transit sample, everyone still at LOW, fixed dwell after entry ---
  const t0 = Date.now();
  let gateHitAt = null, lastGate = null;
  while ((Date.now() - t0) / 1000 < 300) {
    const g = await page.evaluate(GATE).catch(() => null);
    if (g) { lastGate = g; if (g.phase === 'deep_space') { gateHitAt = (Date.now() - t0) / 1000; break; } }
    await new Promise(r => setTimeout(r, 700));
  }
  await new Promise(r => setTimeout(r, 8000));
  const midSample = await page.evaluate(SAMPLE).catch(e => ({ sampleError: String(e).slice(0, 300) }));
  await page.screenshot({ path: path.join(CAP_DIR, `${id}_mid_LOW.png`) });

  // --- gate on the reproducible late state: beat === 'done' + dwell --------
  const t1 = Date.now();
  let doneAt = null;
  while ((Date.now() - t1) / 1000 < 300) {
    const b = await page.evaluate(() => window.__storyBeat ?? null).catch(() => null);
    if (b === 'done') { doneAt = (Date.now() - t1) / 1000; break; }
    await new Promise(r => setTimeout(r, 700));
  }
  await new Promise(r => setTimeout(r, DWELL_MS));

  const preSample = await page.evaluate(SAMPLE).catch(e => ({ sampleError: String(e).slice(0, 300) }));
  await page.screenshot({ path: path.join(CAP_DIR, `${id}_preraise_LOW.png`) });

  const applied = await page.evaluate(RAISE, profile).catch(e => 'RAISE_FAILED ' + String(e).slice(0, 120));
  await new Promise(r => setTimeout(r, profile === 'HIGH' || profile === 'ULTRA' ? HIGH_SETTLE_MS : OTHER_SETTLE_MS));

  const sample = await page.evaluate(SAMPLE).catch(e => ({ sampleError: String(e).slice(0, 300) }));
  await page.screenshot({ path: path.join(CAP_DIR, `${id}_${profile}.png`) });

  report.runs.push({
    id, requestedProfile: profile, appliedProfile: applied,
    reducedMotion: opts.reducedMotion === 'reduce',
    deviceScaleFactor: opts.deviceScaleFactor ?? 1,
    gateHitAtSeconds: gateHitAt, gateStateAtBreak: lastGate, doneAtSeconds: doneAt,
    midFile: `evidence/capture/lens-divergence/${id}_mid_LOW.png`,
    preRaiseFile: `evidence/capture/lens-divergence/${id}_preraise_LOW.png`,
    file: `evidence/capture/lens-divergence/${id}_${profile}.png`,
    midSample, preRaiseSample: preSample, sample,
    wallSeconds: Number(((Date.now() - started) / 1000).toFixed(1)),
    pageErrors: errs
  });
  flush();
  const m = midSample.camera ?? {};
  console.log(`[${id}] MID beat=${midSample.beat} camFov=${m.fov} canopyPx=${midSample.canopyProjection?.widthPx} `
    + `cockpitDist=${midSample.cockpit?.root?.distanceFromRenderCamera} passes=${JSON.stringify(midSample.renderPasses?.perCanvas)}`);
  const c = sample.camera ?? {};
  console.log(`[${id}] profile=${sample.qualityProfile} camFov=${c.fov} aspect=${c.aspect} `
    + `glSize=${JSON.stringify(sample.renderer?.glGetSize)} pr=${sample.renderer?.glPixelRatio} `
    + `flightFov=${sample.shipFlightFeedback?.fov?.toFixed?.(2)} `
    + `canopyPx=${sample.canopyProjection?.widthPx}x${sample.canopyProjection?.heightPx} `
    + `cockpitDist=${sample.cockpit?.root?.distanceFromRenderCamera} errs=${errs.length}`);
  await page.close();
}

await run('low', 'LOW', {});
await run('medium-rm', 'MEDIUM', { reducedMotion: 'reduce' });
await run('high', 'HIGH', {});
await run('potato', 'POTATO', {});

await browser.close();
flush();
console.log('wrote', OUT);
