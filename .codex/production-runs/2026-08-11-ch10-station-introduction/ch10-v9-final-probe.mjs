// draft-v9 FINAL EVIDENCE probe (last capture pass).
//
// FIXES vs ch10-v7-final-probe.mjs:
//  * hull/light disambiguation: BOTH station batches call setColorAt, so both
//    carry instanceColor and the v7 guard at line 262 could never fire. The
//    hull is now picked by the aStationStyle geometry attribute (hull-only)
//    and cross-checked against __spaceStationExterior() diagnostics.
//  * spine law logged at capture: 3-D PCA axis, L, psi, FOVh, K, and the LIVE
//    renderCamera fov on every composition sample.
//  * tangent-correct mask angles by unprojecting the mask extremes.
//  * the lane is read back from location.href and asserted in page.
//
// Every in-page module is resolved through the APP'S OWN (HMR-timestamped)
// specifier — a bare import('/src/...') hands back a second, pristine module
// instance and describes a runtime nobody is playing. ONE browser, ONE page at
// a time.
//
// Modes:
//   --mode=strips     regenerate strip-transit-a / -b / -rm-transit from
//                     post-fix flights, and MEASURE composition on every frame:
//                     render-camera fov, flight fov, cockpit shell world scale,
//                     the cockpit aperture in PIXELS (measured by a
//                     cockpit-hidden differential frame, not a colour guess),
//                     and the station spine by PCA over the rendered hull
//                     instances.
//   --mode=seam       still-seam-of-light: shutter armed in-page on rAF at the
//                     frame where story:ch10-seam-passed latches, HIGH, plus a
//                     paired LOW frame at the same latch edge.
//   --mode=cutline    still-station-resolved: first frame after
//                     threshold-handback, K11 painted, work order cleared.
//   --mode=st0still   still-st0-sighting at the v5 operational staging: camera
//                     <=25u from the habitat-core handle, deep night, yaw
//                     closed-loop through the HIGH warm.
//   --mode=st0cross   regenerate strip-st0-crossing with the gaze bias live;
//                     reports in-frustum frames of 8 and samples of 432.
//   --mode=ux1        UX-1: manual lane, both entry paths, reboard/ignite.
//   --mode=variants   UX-3/UX-4: four-profile matrix post-deferral across
//                     ch10-cold / -ask / -transit, plus a manual (non-movie)
//                     marker-invariant path.
//   --mode=berth      berth ring absent in story transit/resolve, present and
//                     unchanged in the ?spacestation= sandbox.
//   --mode=occl       ST-0 occlusion and device-projected size at four profiles.
//   --mode=da6        D-A6: manual-flight thrust suppression for the hold.
//   --mode=e2e        one end-to-end ?story=base&movie=1&profile=LOW run.
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = await import(
  '/home/thomasphillip/Projects/vox/main/node_modules/playwright-core/index.mjs'
);

const RUN_DIR = path.dirname(new URL(import.meta.url).pathname);
const CAP_DIR = path.join(RUN_DIR, 'evidence', 'capture');
const OUT_DIR = path.join(RUN_DIR, 'evidence', 'verification');
const SCRATCH = process.env.VOX_SCRATCH
  ?? '/tmp/claude-1000/-home-thomasphillip-Projects-vox/4c6601d0-eb4e-4134-a9ec-ba9c68378cc1/scratchpad/v7';
const BASE = process.env.VOX_BASE ?? 'http://localhost:5174';
const MODE = (process.argv.find(a => a.startsWith('--mode=')) ?? '--mode=strips').split('=')[1];
fs.mkdirSync(CAP_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(SCRATCH, { recursive: true });
const pwDir = path.join(os.homedir(), '.cache/ms-playwright');
const chromeDir = fs.readdirSync(pwDir).filter(d => /^chromium-\d+$/.test(d)).sort().pop();

// ---------------------------------------------------------------- in-page code
const RESOLVE = async () => {
  const hosts = ['/src/App.tsx', '/src/story/StoryDirectorDriver.tsx',
    '/src/story/emergentStoryDirector.ts', '/src/components/ShipController.tsx',
    '/src/components/SystemCompanionBodies.tsx', '/src/story/autopilot.ts',
    '/src/components/CameraControls.tsx', '/src/story/storyDirector.ts',
    '/src/components/SystemSpaceStations.tsx', '/src/components/ShipCockpit.tsx'];
  const want = {
    signedAv: /signedSceneAvRuntime\.ts/, spaceFlight: /state\/spaceFlight\.ts/,
    systemFlight: /state\/systemFlight\.ts/, storyState: /story\/storyState\.ts/,
    progression: /progressionSystem\.ts/, graphics: /config\/graphicsSettings\.ts/,
    score: /emergentScoreDirector\.ts/, relay: /world\/WreckRelay\.tsx/,
    worldClock: /game\/worldClock\.ts/, nightState: /utils\/nightState\.ts/,
    autopilot: /\/autopilot\.ts/, devFlag: /spaceStationDevFlag\.ts/,
    director: /emergentStoryDirector\.ts/, companion: /systemCompanionBodiesModel\.ts/,
    inputPolicy: /storyInputPolicy\.ts/, flightFeedback: /shipFlightFeedback\.ts/,
    exterior: /spaceStation\/spaceStationExterior\.ts/, cues: /ux\/feedbackCues\.ts/,
    cockpitLayout: /shipCockpitLayout\.ts/, cinematicLook: /cinematicLook\.ts/, habitat: /habitatSystem\.ts/,
    playerFrame: /state\/playerFrame\.ts/, mobileInput: /mobileInput\.ts/,
    tidegarden: /tidegardenRoute\.ts/,
    companionModel: /systemCompanionBodiesModel\.ts/
  };
  const found = {};
  for (const h of hosts) {
    let src; try { src = await (await fetch(h)).text(); } catch { continue; }
    for (const [k, re] of Object.entries(want)) {
      if (found[k]) continue;
      for (const m of src.matchAll(/from\s*["']([^"']+)["']/g)) if (re.test(m[1])) { found[k] = m[1]; break; }
    }
  }
  // two-hop: feedbackCues is imported only by ux/objectiveDirector.ts, which is
  // itself only reachable through the director's own HMR specifier.
  if (!found.cues) {
    try {
      const dsrc = found.director ? await (await fetch(found.director)).text() : '';
      const objSpec = [...dsrc.matchAll(/from\s*["']([^"']+)["']/g)]
        .map(m => m[1]).find(u => /objectiveDirector\.ts/.test(u));
      if (objSpec) {
        const osrc = await (await fetch(objSpec)).text();
        found.cues = [...osrc.matchAll(/from\s*["']([^"']+)["']/g)]
          .map(m => m[1]).find(u => /feedbackCues\.ts/.test(u)) ?? null;
        found.objectiveDirector = objSpec;
      }
    } catch { /* ignore */ }
  }
  window.__voxSpec = found;
  try {
    const canvas = document.querySelector('canvas');
    const store = canvas?.__r3f?.root;
    if (store?.getState) window.__voxRoot = store;
  } catch { /* ignore */ }
  try {
    const cs = await (await fetch('/src/components/SystemCompanionBodies.tsx')).text();
    const threeUrl = cs.match(/from\s*["']([^"']*deps\/three\.js[^"']*)["']/)[1];
    const THREE = await import(/* @vite-ignore */ threeUrl);
    window.__THREE = THREE;
    if (!window.__voxHooked) {
      window.__voxScenes = new Map();
      window.__voxCameras = new Map();
      const base = THREE.Object3D.prototype.updateMatrixWorld;
      THREE.Scene.prototype.updateMatrixWorld = function (f) {
        window.__voxScenes.set(this, (window.__voxScenes.get(this) ?? 0) + 1); return base.call(this, f); };
      THREE.PerspectiveCamera.prototype.updateMatrixWorld = function (f) {
        window.__voxCameras.set(this, (window.__voxCameras.get(this) ?? 0) + 1); return base.call(this, f); };
      // WebGLRenderer assigns `render` as an OWN property, so the prototype is
      // not patchable; Scene.onBeforeRender receives the real renderer.
      const baseOBR = THREE.Object3D.prototype.onBeforeRender;
      THREE.Scene.prototype.onBeforeRender = function (renderer, scene, camera, rt) {
        const el = renderer?.domElement;
        const px = el ? el.width * el.height : 0;
        if (px > (window.__voxRendererPx ?? 0)) {
          window.__voxRendererPx = px; window.__voxRenderer = renderer;
        }
        return baseOBR.call(this, renderer, scene, camera, rt);
      };
      window.__voxHooked = true;
    }
  } catch (e) { window.__voxThreeError = String(e).slice(0, 160); }
  window.__voxPick = () => {
    const w = window;
    const st = w.__voxRoot?.getState?.() ?? null;
    let scene = st?.scene ?? null, camera = st?.camera ?? null;
    if (!scene && w.__voxScenes) {
      for (const s of w.__voxScenes.keys()) {
        let hit = false;
        s.traverse(o => { if (o.name === 'system-companion-bodies' || o.name === 'system-st0-station-light') hit = true; });
        if (hit) { scene = s; break; }
      }
    }
    if (!camera && w.__voxCameras) {
      let bestTicks = -1;
      for (const [c, ticks] of w.__voxCameras.entries()) {
        if (!c.isPerspectiveCamera) continue;
        if (!(c.fov > 20 && c.fov < 140) || !(c.far > 500)) continue;
        if (ticks > bestTicks) { bestTicks = ticks; camera = c; }
      }
    }
    return { scene, camera };
  };
  window.__voxAim = () => {
    const THREE = window.__THREE;
    const { camera } = window.__voxPick();
    if (!camera || !THREE) return null;
    camera.updateMatrixWorld(true);
    const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
    const up = camPos.clone().normalize();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    const eN = east.length() > 1e-6 ? east.normalize() : new THREE.Vector3(1, 0, 0);
    const nN = up.clone().cross(eN).normalize();
    const flat = fwd.clone().addScaledVector(up, -fwd.dot(up));
    return { az: Math.atan2(flat.dot(eN), flat.dot(nN)) * 180 / Math.PI,
      alt: 90 - Math.acos(Math.max(-1, Math.min(1, fwd.dot(up)))) * 180 / Math.PI,
      fov: camera.fov };
  };
  if (!window.__voxTap && found.cues) {
    try {
      const cues = await import(/* @vite-ignore */ found.cues);
      window.__voxFeedbackLog = [];
      window.__voxTap = cues.subscribeStoryUxFeedback(c => {
        window.__voxFeedbackLog.push({ at: Math.round(performance.now()), cue: c,
          beat: window.__storyBeat ?? null, objectiveId:
            document.querySelector('[data-story-guidance-hud]')?.getAttribute('data-objective-id') ?? null });
      });
    } catch { /* ignore */ }
  }
  return found;
};

// --- composition: the ACTUAL lens, the cockpit rig, and the station spine ----
const COMPOSE = () => {
  const w = window, THREE = w.__THREE;
  const { scene, camera } = w.__voxPick ? w.__voxPick() : { scene: null, camera: null };
  const out = { composeError: null };
  if (!scene || !camera || !THREE) { out.composeError = 'no scene/camera'; return out; }
  camera.updateMatrixWorld(true);
  const gl = w.__voxRoot?.getState?.()?.gl ?? null;
  const size = w.__voxRoot?.getState?.()?.size ?? null;
  const W = gl ? gl.domElement.clientWidth || window.innerWidth : window.innerWidth;
  const H = gl ? gl.domElement.clientHeight || window.innerHeight : window.innerHeight;
  out.viewport = { cssW: W, cssH: H, r3fSize: size ? { w: size.width, h: size.height } : null,
    dpr: window.devicePixelRatio, glPixelRatio: gl ? gl.getPixelRatio() : null,
    drawingBuffer: gl ? [gl.domElement.width, gl.domElement.height] : null };
  out.renderCamera = { fov: Number(camera.fov.toFixed(4)), aspect: Number((camera.aspect ?? 0).toFixed(4)),
    zoom: camera.zoom, near: camera.near, far: camera.far, uuid: camera.uuid };

  // cockpit rig: the FOV-compensated shell and the aperture it frames
  let cockpit = null, shell = null, instruments = null;
  const seek = (root) => root && root.traverse(o => {
    if (o.name === 'ship-cockpit') cockpit = o;
    else if (o.name === 'ship-cockpit-pressure-shell') shell = o;
    else if (o.name === 'ship-cockpit-instruments') instruments = o;
  });
  seek(scene); if (!cockpit) seek(camera);
  const wsc = (o) => { if (!o) return null; const s = new THREE.Vector3();
    o.updateWorldMatrix(true, false); o.getWorldScale(s);
    return [s.x, s.y, s.z].map(n => Number(n.toFixed(5))); };
  out.cockpit = {
    present: !!cockpit, visible: cockpit?.visible ?? null,
    rootWorldScale: wsc(cockpit), shellLocalScale: shell
      ? [shell.scale.x, shell.scale.y, shell.scale.z].map(n => Number(n.toFixed(5))) : null,
    shellWorldScale: wsc(shell), instrumentLocalScale: instruments
      ? [instruments.scale.x, instruments.scale.y, instruments.scale.z].map(n => Number(n.toFixed(5))) : null,
    distanceFromCamera: (() => {
      if (!cockpit) return null; const a = new THREE.Vector3(); cockpit.getWorldPosition(a);
      const b = new THREE.Vector3(); camera.getWorldPosition(b);
      return Number(a.distanceTo(b).toFixed(4)); })()
  };

  // station spine: PCA over the RENDERED hull instances (count respects both
  // the tier cull and the dock-offer suppression).
  const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
  const inst = [];
  scene.traverse(o => { if (o.isInstancedMesh && o.count > 0) inst.push(o); });
  const contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  const stationDist = contacts?.stations?.[0]?.distance ?? null;
  // STRUCTURAL pick, not a distance match: SpaceStationExterior mounts exactly
  // two InstancedMeshes (hull + lights) under one Group whose position is the
  // station centre. Distance matching failed below ~4 km because the contact
  // distance is ship-to-centre while the camera sits at the cockpit.
  const groups = new Map();
  for (const m of inst) {
    const p = m.parent; if (!p) continue;
    let banned = false;
    for (let o = m; o; o = o.parent) if (/companion|galaxy|impostor|st0|star/i.test(o.name || '')) banned = true;
    if (banned) continue;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(m);
  }
  let hull = null, lights = null, hullGroup = null, bestD = Infinity, bestErr = Infinity;
  for (const [g, ms] of groups.entries()) {
    if (ms.length < 2) continue;
    const gp = new THREE.Vector3(); g.getWorldPosition(gp);
    const d = gp.distanceTo(camPos);
    if (!Number.isFinite(d) || d < 50) continue;
    // Structural signature narrows the field; the station contact distance
    // then picks WHICH two-batch group is the station (the ship carries its own).
    const err = stationDist != null ? Math.abs(d - stationDist) / stationDist : d / 1e6;
    if (err < bestErr) {
      bestErr = err; bestD = d; hullGroup = g;
      const sorted = [...ms].sort((a, b) => b.count - a.count);
      hull = sorted[0]; lights = sorted[1];
    }
  }
  if (stationDist != null && bestErr > 0.35) { hull = null; lights = null; hullGroup = null; bestD = Infinity; }
  out.stationGroupDistanceError = Number.isFinite(bestErr) ? Number(bestErr.toFixed(4)) : null;
  w.__voxStationGroup = hullGroup;
  out.stationGroupResolved = !!hullGroup;
  // hull is the batch WITHOUT a blink/emissive light signature: keep the larger
  // of the two only if it also has instanceColor (the hull tones).
  // FIX (v7 line 262 was dead): both batches call setColorAt, so both carry
  // instanceColor and the swap never fired -- v7's "hull" was whichever batch
  // had the larger count, i.e. the 613 emissives. The hull is the ONLY batch
  // whose geometry carries the aStationStyle attribute (SpaceStationExterior
  // attaches it to the hull boxGeometry alone); the lights are a plain
  // boxGeometry with a MeshBasicMaterial.
  if (hullGroup) {
    const ms = groups.get(hullGroup) ?? [];
    const styled = ms.filter(m => !!m.geometry?.attributes?.aStationStyle);
    const basic = ms.filter(m => !!m.material?.isMeshBasicMaterial);
    if (styled.length === 1) {
      hull = styled[0];
      lights = ms.find(m => m !== hull) ?? null;
      out.hullPickedBy = 'aStationStyle';
    } else if (basic.length === 1) {
      lights = basic[0];
      hull = ms.find(m => m !== lights) ?? null;
      out.hullPickedBy = 'meshBasicMaterial';
    } else out.hullPickedBy = 'count-fallback';
  }
  // ground truth from the component's own diagnostics
  try {
    const d = w.__spaceStationExterior ? w.__spaceStationExterior() : null;
    out.exteriorDiag = d ? { range: Number((d.range ?? 0).toFixed(1)),
      hullInstances: d.hullInstances, hullTotal: d.hullTotal,
      lightInstances: d.lightInstances } : null;
    out.hullPickAgreesWithDiag = d && hull ? hull.count === d.hullInstances : null;
  } catch { out.exteriorDiag = null; }
  out.instancedBatches = inst.map(m => {
    const gp = new THREE.Vector3(); (m.parent ?? m).getWorldPosition(gp);
    return { name: m.name || m.type, parent: m.parent?.name || m.parent?.type || null,
      count: m.count, groupDistance: Number(gp.distanceTo(camPos).toFixed(1)) };
  }).sort((a, b) => a.groupDistance - b.groupDistance).slice(0, 10);
  out.stationGroupDistance = Number.isFinite(bestD) ? Number(bestD.toFixed(1)) : null;
  out.stationDistance = stationDist;
  out.stationHullInstances = hull ? hull.count : null;
  out.stationLightInstances = lights ? lights.count : null;
  if (hull && hull.count > 0) {
    // Silhouette, not centroids: every instance is a unit box scaled by its
    // size, so the eight corners are the shape the frame actually shows.
    const pts2 = [], pts3 = [];
    const mat = new THREE.Matrix4(), pos = new THREE.Vector3();
    const CORNERS = [];
    for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) for (const sz of [-0.5, 0.5]) CORNERS.push([sx, sy, sz]);
    for (let i = 0; i < hull.count; i++) {
      hull.getMatrixAt(i, mat);
      for (const c of CORNERS) {
        pos.set(c[0], c[1], c[2]).applyMatrix4(mat).applyMatrix4(hull.matrixWorld);
        pts3.push(pos.clone());
        const ndc = pos.clone().project(camera);
        pts2.push([(ndc.x * 0.5 + 0.5) * W, (-ndc.y * 0.5 + 0.5) * H, ndc.z]);
      }
    }
    const inFront = pts2.filter(p => p[2] > -1 && p[2] < 1);
    const use = inFront.length ? inFront : pts2;
    const mx = use.reduce((s, p) => s + p[0], 0) / use.length;
    const my = use.reduce((s, p) => s + p[1], 0) / use.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of use) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy; }
    sxx /= use.length; sxy /= use.length; syy /= use.length;
    const tr = sxx + syy, det = sxx * syy - sxy * sxy;
    const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const ax = Math.abs(sxy) > 1e-9 ? [l1 - syy, sxy] : (sxx >= syy ? [1, 0] : [0, 1]);
    const an = Math.hypot(ax[0], ax[1]) || 1;
    const u = [ax[0] / an, ax[1] / an], v = [-u[1], u[0]];
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity, uMinI = 0, uMaxI = 0;
    use.forEach((p, i) => {
      const du = (p[0] - mx) * u[0] + (p[1] - my) * u[1];
      const dv = (p[0] - mx) * v[0] + (p[1] - my) * v[1];
      if (du < uMin) { uMin = du; uMinI = i; }
      if (du > uMax) { uMax = du; uMaxI = i; }
      vMin = Math.min(vMin, dv); vMax = Math.max(vMax, dv);
    });
    const xs = use.map(p => p[0]), ys = use.map(p => p[1]);
    // angular measures from the 3-D extremes along the same major axis
    const a3 = pts3[pts2.indexOf(use[uMinI])] ?? pts3[0];
    const b3 = pts3[pts2.indexOf(use[uMaxI])] ?? pts3[0];
    const da = a3.clone().sub(camPos).normalize(), db = b3.clone().sub(camPos).normalize();
    out.stationSpine = {
      instances: hull.count,
      spineLengthPx: Number((uMax - uMin).toFixed(1)),
      spineThicknessPx: Number((vMax - vMin).toFixed(1)),
      spinePercentOfFrameWidth: Number((((uMax - uMin) / W) * 100).toFixed(2)),
      screenBBoxPx: [Number((Math.max(...xs) - Math.min(...xs)).toFixed(1)),
        Number((Math.max(...ys) - Math.min(...ys)).toFixed(1))],
      bboxPercentOfFrameWidth: Number((((Math.max(...xs) - Math.min(...xs)) / W) * 100).toFixed(2)),
      centroidPx: [Number(mx.toFixed(1)), Number(my.toFixed(1))],
      centroidPercentX: Number(((mx / W) * 100).toFixed(2)),
      spineVisualAngleDeg: Number((Math.acos(Math.max(-1, Math.min(1, da.dot(db)))) * 180 / Math.PI).toFixed(3)),
      thicknessVisualAngleDeg: Number((((vMax - vMin) / H) * camera.fov).toFixed(3)),
      offAxisDeg: (() => {
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const gp = new THREE.Vector3(); (hull.parent ?? hull).getWorldPosition(gp);
        const dir = gp.sub(camPos).normalize();
        return Number((Math.acos(Math.max(-1, Math.min(1, dir.dot(fwd)))) * 180 / Math.PI).toFixed(3));
      })()
    };
  }
  // ---- THE SPINE LAW, computed at capture from the LIVE spine geometry ----
  // f(Z) = K/Z with K = L*sin(psi) / (2*tan(FOVh/2)); theta(Z) = 2*atan(L*sin psi / 2Z).
  // The axis is a 3-D PCA over the RENDERED hull instance centres (not a
  // hard-coded constant), so L and psi are measured, and K is derived.
  out.spineLaw = null;
  if (hull && hull.count > 0) {
    const mat = new THREE.Matrix4(), pos = new THREE.Vector3();
    const cen = [];
    for (let i = 0; i < hull.count; i++) {
      hull.getMatrixAt(i, mat);
      pos.set(0, 0, 0).applyMatrix4(mat).applyMatrix4(hull.matrixWorld);
      cen.push(pos.clone());
    }
    const c = new THREE.Vector3();
    for (const q of cen) c.add(q);
    c.multiplyScalar(1 / cen.length);
    // power iteration on the 3x3 covariance
    const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (const q of cen) {
      const d = [q.x - c.x, q.y - c.y, q.z - c.z];
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) cov[a * 3 + b] += d[a] * d[b];
    }
    for (let i = 0; i < 9; i++) cov[i] /= cen.length;
    let vec = [1, 1, 1];
    for (let it = 0; it < 96; it++) {
      const n = [0, 0, 0];
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) n[a] += cov[a * 3 + b] * vec[b];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      vec = [n[0] / len, n[1] / len, n[2] / len];
    }
    const axis = new THREE.Vector3(vec[0], vec[1], vec[2]).normalize();
    let lo = Infinity, hi = -Infinity;
    for (const q of cen) { const t = q.clone().sub(c).dot(axis); if (t < lo) lo = t; if (t > hi) hi = t; }
    const L = hi - lo;
    const los = c.clone().sub(camPos);
    const Z = los.length();
    const losN = los.clone().normalize();
    const cosA = Math.max(-1, Math.min(1, axis.dot(losN)));
    const psi = Math.acos(Math.abs(cosA));              // angle spine-vs-line-of-sight
    const sinPsi = Math.sin(psi);
    const aspect = camera.aspect ?? (W / H);
    const fovV = camera.fov;
    const fovH = 2 * Math.atan(Math.tan((fovV * Math.PI / 180) / 2) * aspect) * 180 / Math.PI;
    const K = (L * sinPsi) / (2 * Math.tan((fovH * Math.PI / 180) / 2));
    const thetaDeg = 2 * Math.atan((L * sinPsi) / (2 * Z)) * 180 / Math.PI;
    // the spine group's own world quaternion, recorded as the contract asks
    const gq = new THREE.Quaternion();
    (hullGroup ?? hull).getWorldQuaternion(gq);
    out.spineLaw = {
      hullInstances: hull.count,
      spineAxisWorld: [axis.x, axis.y, axis.z].map(n => Number(n.toFixed(5))),
      spineGroupQuaternion: [gq.x, gq.y, gq.z, gq.w].map(n => Number(n.toFixed(5))),
      spineCentreWorld: [c.x, c.y, c.z].map(n => Number(n.toFixed(2))),
      L: Number(L.toFixed(2)),
      L_contract: 865.0,
      psiDeg: Number((psi * 180 / Math.PI).toFixed(3)),
      psiDeg_contract: 55.572,
      sinPsi: Number(sinPsi.toFixed(5)),
      Z: Number(Z.toFixed(1)),
      fovV: Number(fovV.toFixed(4)),
      aspect: Number(aspect.toFixed(4)),
      fovH: Number(fovH.toFixed(4)),
      K: Number(K.toFixed(2)),
      K_contract: 286.57,
      predictedOccupancyPercent: Number(((K / Z) * 100).toFixed(2)),
      predictedThetaDeg: Number(thetaDeg.toFixed(3)),
      tolerance: 0.05
    };
  }

  // named sky bodies
  out.sky = { st0: null, companions: [], galaxy: [] };
  const proj = (o) => {
    const wp = new THREE.Vector3(); o.getWorldPosition(wp);
    const ndc = wp.clone().project(camera);
    return { name: o.name, visible: o.visible, opacity: o.material?.opacity ?? null,
      ndc: [Number(ndc.x.toFixed(4)), Number(ndc.y.toFixed(4))],
      inFrame: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1 };
  };
  scene.traverse(o => {
    if (o.name === 'system-st0-station-light') out.sky.st0 = proj(o);
    else if (/^system-companion-body-/.test(o.name)) out.sky.companions.push(proj(o));
    else if (/galaxy/i.test(o.name)) out.sky.galaxy.push(proj(o));
  });
  return out;
};

// Differential masking: the only honest pixel measurement of "what does this
// object occupy in THIS frame". Hide it, shoot, restore; the difference is the
// object, with no colour heuristic and no confusion with the moon or the HUD.
const STATION_TOGGLE = (visible) => {
  const g = window.__voxStationGroup;
  if (!g) return false;
  g.visible = visible;
  return true;
};

/**
 * SINGLE-INSTANT differential masks. Screenshot pairs cannot do this: at 300 u/s
 * the whole frame moves between two shots and the "difference" is the sky. Here
 * the three renders happen inside ONE task with one camera pose, so the
 * difference is exactly the object that was switched off.
 *
 * Returns the cockpit aperture (the widest hole enclosed by the cockpit
 * silhouette on a scanline) and the station silhouette by PCA over its own mask.
 * Measured in DRAWING-BUFFER pixels and normalised to frame width, so a render
 * scale cannot flatter or punish the reading.
 */
const MASKS = () => {
  const w = window, THREE = w.__THREE;
  const st = w.__voxRoot?.getState?.() ?? null;
  const { scene, camera } = w.__voxPick();
  const gl = st?.gl ?? w.__voxRenderer ?? null;
  if (!gl || !scene || !camera) return { maskError: 'no renderer' };
  const ctx = gl.getContext();
  const W = gl.domElement.width, H = gl.domElement.height;
  if (!(W > 0 && H > 0)) return { maskError: 'no buffer' };
  if (W * H > 4.2e6) return { maskError: 'buffer too large' };
  const prevTarget = gl.getRenderTarget();
  gl.setRenderTarget(null);
  const shot = () => {
    gl.render(scene, camera);
    const buf = new Uint8Array(W * H * 4);
    ctx.readPixels(0, 0, W, H, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
    return buf;
  };
  const findByName = (n) => {
    let hit = null;
    scene.traverse(o => { if (!hit && o.name === n) hit = o; });
    if (!hit && camera) camera.traverse(o => { if (!hit && o.name === n) hit = o; });
    return hit;
  };
  const base = shot();
  const diffMask = (obj) => {
    if (!obj) return null;
    const was = obj.visible;
    obj.visible = false;
    const other = shot();
    obj.visible = was;
    const m = new Uint8Array(W * H);
    let count = 0;
    for (let i = 0, p = 0; i < m.length; i++, p += 4) {
      const d = Math.abs(base[p] - other[p]) + Math.abs(base[p + 1] - other[p + 1])
        + Math.abs(base[p + 2] - other[p + 2]);
      if (d > 10) { m[i] = 1; count++; }
    }
    return { m, count };
  };
  const out = { bufferSize: [W, H] };
  // --- cockpit aperture ---------------------------------------------------
  const cockpit = findByName('ship-cockpit');
  const cm = diffMask(cockpit);
  if (cm && cm.count > 500) {
    let best = 0, bestRow = null, bestSpan = null;
    let minX = W, maxX = -1, minY = H, maxY = -1;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      let lo = -1, hi = -1;
      for (let x = 0; x < W; x++) if (cm.m[row + x]) { if (lo < 0) lo = x; hi = x; }
      if (lo < 0) continue;
      if (lo < minX) minX = lo;
      if (hi > maxX) maxX = hi;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      let run = 0, mx = 0, mxEnd = 0;
      for (let x = lo; x <= hi; x++) {
        if (!cm.m[row + x]) { run++; if (run > mx) { mx = run; mxEnd = x; } } else run = 0;
      }
      if (mx > best) { best = mx; bestRow = y; bestSpan = [mxEnd - mx + 1, mxEnd]; }
    }
    // S-1: "no sky visible past the cockpit shell". The shell is rigid to the
    // camera, so the honest test is whether its silhouette still reaches the
    // frame border. Border coverage < 100% means the frame edge shows world.
    let border = 0, borderTotal = 0;
    for (let x = 0; x < W; x++) { borderTotal += 2;
      if (cm.m[x]) border++; if (cm.m[(H - 1) * W + x]) border++; }
    for (let y = 0; y < H; y++) { borderTotal += 2;
      if (cm.m[y * W]) border++; if (cm.m[y * W + (W - 1)]) border++; }
    out.cockpit = {
      borderCoveragePercent: Number(((border / borderTotal) * 100).toFixed(2)),
      maskPixels: cm.count,
      silhouetteBBox: [minX, minY, maxX - minX + 1, maxY - minY + 1],
      apertureWidthPx: best,
      apertureRow: bestRow,
      apertureSpanPx: bestSpan,
      // readings are in buffer pixels; give the 1280-wide equivalent too
      apertureWidthAt1280: Number(((best / W) * 1280).toFixed(1)),
      aperturePercentOfFrameWidth: Number(((best / W) * 100).toFixed(2))
    };
  } else out.cockpit = { maskPixels: cm ? cm.count : null, apertureWidthPx: null };
  // --- station silhouette -------------------------------------------------
  const sm = diffMask(w.__voxStationGroup ?? null);
  if (sm && sm.count > 40) {
    let sx = 0, sy = 0, n = 0, minX = W, maxX = -1, minY = H, maxY = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sm.m[y * W + x]) {
      sx += x; sy += y; n++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const mx = sx / n, my = sy / n;
    let sxx = 0, sxy = 0, syy = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sm.m[y * W + x]) {
      const dx = x - mx, dy = y - my; sxx += dx * dx; sxy += dx * dy; syy += dy * dy;
    }
    sxx /= n; sxy /= n; syy /= n;
    const tr = sxx + syy, det = sxx * syy - sxy * sxy;
    const l1 = tr / 2 + Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const ax = Math.abs(sxy) > 1e-9 ? [l1 - syy, sxy] : (sxx >= syy ? [1, 0] : [0, 1]);
    const an = Math.hypot(ax[0], ax[1]) || 1;
    const u = [ax[0] / an, ax[1] / an], v = [-u[1], u[0]];
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sm.m[y * W + x]) {
      const du = (x - mx) * u[0] + (y - my) * u[1];
      const dv = (x - mx) * v[0] + (y - my) * v[1];
      if (du < uMin) uMin = du; if (du > uMax) uMax = du;
      if (dv < vMin) vMin = dv; if (dv > vMax) vMax = dv;
    }
    const degPerPxV = camera.fov / H;
    // TANGENT-CORRECT angular measure: unproject the two mask extremes along
    // each principal axis into camera-space rays and take the ray angle. A
    // linear px*fov/H conversion is explicitly NOT the contracted convention.
    const rayAt = (px, py) => {
      const ndc = new THREE.Vector3((px / W) * 2 - 1, -((py / H) * 2 - 1), 0.5);
      return ndc.unproject(camera).sub(camPosM).normalize();
    };
    const camPosM = new THREE.Vector3(); camera.getWorldPosition(camPosM);
    const ptAt = (du, dv) => [mx + u[0] * du + v[0] * dv, my + u[1] * du + v[1] * dv];
    const angBetween = (p1, p2) => {
      const r1 = rayAt(p1[0], p1[1]), r2 = rayAt(p2[0], p2[1]);
      return Math.acos(Math.max(-1, Math.min(1, r1.dot(r2)))) * 180 / Math.PI;
    };
    const spineAngTan = angBetween(ptAt(uMin, 0), ptAt(uMax, 0));
    const thickAngTan = angBetween(ptAt(0, vMin), ptAt(0, vMax));
    out.station = {
      spineAngleTangentDeg: Number(spineAngTan.toFixed(3)),
      thicknessAngleTangentDeg: Number(thickAngTan.toFixed(3)),
      spineToThicknessRatio: thickAngTan > 1e-6 ? Number((spineAngTan / thickAngTan).toFixed(2)) : null,
      spineToThicknessRatioPx: (vMax - vMin) > 1e-6 ? Number(((uMax - uMin) / (vMax - vMin)).toFixed(2)) : null,
      maskPixels: sm.count,
      spineLengthPx: Number((uMax - uMin).toFixed(1)),
      spineThicknessPx: Number((vMax - vMin).toFixed(1)),
      spinePercentOfFrameWidth: Number((((uMax - uMin) / W) * 100).toFixed(2)),
      thicknessPercentOfFrameWidth: Number((((vMax - vMin) / W) * 100).toFixed(2)),
      spineVisualAngleDeg: Number(((uMax - uMin) * degPerPxV).toFixed(3)),
      thicknessVisualAngleDeg: Number(((vMax - vMin) * degPerPxV).toFixed(3)),
      silhouetteBBox: [minX, minY, maxX - minX + 1, maxY - minY + 1],
      centroidPx: [Number(mx.toFixed(1)), Number(my.toFixed(1))],
      centroidPercentX: Number(((mx / W) * 100).toFixed(2)),
      centroidOffsetFromViewCenterDeg: Number((Math.hypot(
        (mx - W / 2) * degPerPxV, (my - H / 2) * degPerPxV).toFixed(3)))
    };
  } else out.station = { maskPixels: sm ? sm.count : null, resolved: false };
  // Packed cockpit bitmask, so the Node side can define "inside the aperture"
  // on the SCREENSHOT without a colour heuristic. The cockpit is rigid to the
  // camera, so this mask is motion-invariant and pairs with the shutter frame.
  if (cm && cm.count > 500) {
    const bytes = new Uint8Array(Math.ceil((W * H) / 8));
    for (let i = 0; i < W * H; i++) if (cm.m[i]) bytes[i >> 3] |= (1 << (i & 7));
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
    out.cockpitMaskPackedBase64 = btoa(bin);
    out.cockpitMaskSize = [W, H];
    out.cockpitMaskOriginBottomLeft = true;
  }
  if (sm && sm.count > 40) {
    const bytes = new Uint8Array(Math.ceil((W * H) / 8));
    for (let i = 0; i < W * H; i++) if (sm.m[i]) bytes[i >> 3] |= (1 << (i & 7));
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
    out.stationMaskPackedBase64 = btoa(bin);
  }
  gl.setRenderTarget(prevTarget);
  void THREE;
  return out;
};

const COCKPIT_TOGGLE = (visible) => {
  const w = window;
  const { scene, camera } = w.__voxPick();
  let hit = null;
  const seek = (root) => root && root.traverse(o => { if (o.name === 'ship-cockpit') hit = o; });
  seek(scene); if (!hit) seek(camera);
  if (!hit) return false;
  hit.visible = visible;
  w.__voxCockpitRef = hit;
  return true;
};

const READ = async () => {
  const w = window; const spec = w.__voxSpec ?? {};
  const imp = async (k) => (spec[k] ? import(/* @vite-ignore */ spec[k]) : null);
  const hud = document.querySelector('[data-story-guidance-hud]');
  const feed = document.querySelector('aside[aria-label="Current story objective"]');
  const caption = document.querySelector('[data-story-caption]');
  // LANE ASSERTION: read back what the page ACTUALLY opened, never the string
  // the probe intended. A predecessor recorded movie=1 on a page opened without
  // it and three downstream readers reasoned about the wrong lane.
  const href = location.href;
  const qp = new URLSearchParams(location.search);
  const out = { href, lane: qp.get('movie') === '1' ? 'movie' : 'manual',
    urlStory: qp.get('story'), urlProfile: qp.get('profile'),
    autopilotTicking: !!w.__autopilot,
    wallMs: Math.round(performance.now()), beat: w.__storyBeat ?? null,
    objectiveId: hud?.getAttribute('data-objective-id') ?? null,
    markerLabel: hud?.getAttribute('data-objective-marker-label') ?? null,
    health: hud?.getAttribute('data-objective-health') ?? null,
    requiresMarker: hud?.getAttribute('data-objective-requires-marker') ?? null,
    hudText: hud ? hud.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    feedObjectiveId: feed?.getAttribute('data-objective-id') ?? null,
    feedHealth: feed?.getAttribute('data-objective-health') ?? null,
    feedText: feed ? feed.innerText.replace(/\s*\n\s*/g, ' | ').trim() : null,
    caption: caption ? caption.innerText.trim() : null,
    cueCount: (w.__voxFeedbackLog ?? []).length,
    interactionPrompts: [...document.querySelectorAll('[data-interaction-prompt="primary"]')]
      .map(e => e.innerText.replace(/\s*\n\s*/g, ' | ').trim()),
    interactionPromptActive: document.querySelectorAll('[data-interaction-prompt="primary"]').length > 0 };
  try { const f = await imp('spaceFlight');
    if (f) { const s = f.getSpaceFlightSnapshot(); out.flight = { phase: s.phase, controlMode: s.controlMode }; } } catch { /* ignore */ }
  try { const s = await imp('systemFlight');
    if (s) { const v = s.getSystemFlightSnapshot();
      out.system = { activePlanetId: v.activePlanetId, locationMode: v.locationMode,
        targetWorldId: v.target?.worldId ?? null, targetKind: v.target?.kind ?? null,
        pos: (v.pose?.position ?? []).map(n => Math.round(n)),
        speed: Math.round(Math.hypot(...(v.pose?.velocity ?? [0, 0, 0])) * 100) / 100 }; } } catch { /* ignore */ }
  try { const av = await imp('signedAv');
    if (av) { const s = av.getSignedSceneAvDebugSnapshot();
      out.av = { active: s.active, beat: s.beat, anchorId: s.anchorId,
        history: s.activationHistoryAnchorIds ?? [], authority: s.shot?.cameraAuthority ?? null,
        fov: s.shot?.lens?.appliedFovDeg ?? null, agency: s.shot?.agency ?? null,
        letterbox: s.shot?.letterbox ?? null, postFx: s.postFx?.activeEffectIds ?? [],
        reset: s.lastResetReason ?? null }; } } catch { /* ignore */ }
  try { const st = await imp('storyState'); const pr = await imp('progression');
    if (st && pr) out.milestones = {
      faultRead: pr.hasMilestone(st.STORY_MILESTONES.ch10FaultRead),
      fabricationRefused: pr.hasMilestone(st.STORY_MILESTONES.ch10FabricationRefused),
      relayAsked: pr.hasMilestone(st.STORY_MILESTONES.ch10RelayAsked),
      relayAnswered: pr.hasMilestone(st.STORY_MILESTONES.ch10RelayAnswered),
      bearingClaimed: pr.hasMilestone(st.STORY_MILESTONES.ch10BearingClaimed),
      transitIgnited: pr.hasMilestone(st.STORY_MILESTONES.ch10TransitIgnited),
      seamPassed: pr.hasMilestone(st.STORY_MILESTONES.ch10SeamPassed),
      stationResolved: pr.hasMilestone(st.STORY_MILESTONES.ch10StationResolved),
      ch10Complete: pr.hasMilestone(st.STORY_MILESTONES.ch10Complete),
      dockingAuthorized: pr.hasMilestone(st.STORY_MILESTONES.stationDockingAuthorized) }; } catch { /* ignore */ }
  try { const d = await imp('director');
    if (d && d.chapter10GuidanceTrace) out.guidance = d.chapter10GuidanceTrace(); } catch (e) { out.guidanceError = String(e).slice(0, 140); }
  try { const g = await imp('graphics'); if (g) out.qualityProfile = g.getQualityProfile(); } catch { /* ignore */ }
  try { const p = await imp('inputPolicy');
    if (p) { const pol = p.getStoryInputPolicy();
      out.inputPolicy = { targetFov: pol.targetFov ?? null, moveSpeedScale: pol.moveSpeedScale ?? null,
        targetDpr: pol.targetDpr ?? null }; } } catch { /* ignore */ }
  try { const ff = await imp('flightFeedback');
    if (ff) { const s = ff.getShipFlightFeedback();
      out.flightFeedback = { fov: Number(s.fov.toFixed(3)), boost: Number(s.boost.toFixed(3)),
        speed: Number(s.speed.toFixed(1)), reducedMotion: s.reducedMotion, active: s.active }; } } catch { /* ignore */ }
  try { const c = await imp('worldClock'); const n = await imp('nightState');
    if (c && n) { out.dayPhase = Number(c.getCurrentDayPhase().toFixed(4));
      out.daylight = Number(n.daylightFromDayPhase(c.getCurrentDayPhase()).toFixed(4));
      out.isNight = n.isDarkDaylight(out.daylight); } } catch { /* ignore */ }
  try { const sc = await imp('score'); if (sc) out.score = sc.getChapter10ScoreSnapshot(); } catch { /* ignore */ }
  out.contacts = w.__spaceStationContacts ? w.__spaceStationContacts() : null;
  const ap = w.__autopilot;
  if (ap) out.autopilot = { beat: ap.beat, clock: ap.clock, pos: ap.pos, stillTime: ap.stillTime,
    teleportNudgesTotal: ap.teleportNudgesTotal,
    keys: Object.entries(ap.controls ?? {}).filter(([, v]) => v === true).map(([k]) => k) };
  return out;
};

const SET_PROFILE = async (p) => {
  const g = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).graphics);
  g.setQualityProfile(p, { persist: false });
  return g.getQualityProfile();
};


// --- DOM-overlay control -----------------------------------------------------
// page.screenshot() composites the DOM HUD over the canvas. The hero still is
// the composite (K11 and the work-order state are DOM), but the v9 pixel laws
// are laws about RENDERED LIGHT: measuring them over the composite compares
// ST-0 against HUD glyphs and counts the caption band as a warm cluster. So each
// still is shot twice at the same instant -- the hero composite, then a
// scene-only twin with every non-canvas element hidden -- and the laws are
// evaluated on the twin, with the overlay rects recorded for audit.
const UI_RECTS = () => [...document.querySelectorAll('body *')]
  .filter(e => e.tagName !== 'CANVAS' && e.children.length === 0)
  .map(e => { const r = e.getBoundingClientRect();
    return (r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0)
      ? { tag: e.tagName, text: (e.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48),
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] } : null; })
  .filter(Boolean);
const HIDE_UI = () => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return 0;
  // visibility:hidden is inherited but overridable by any descendant rule, and
  // several HUD layers set their own. An !important stylesheet rule that spares
  // only the canvas and its ancestor chain cannot be overridden by a
  // non-important declaration anywhere in the overlay.
  let n = 0;
  for (let el = canvas; el; el = el.parentElement) { el.setAttribute('data-vox-keep', '1'); n++; }
  const style = document.createElement('style');
  style.id = 'vox-hide-ui';
  style.textContent = 'body *:not([data-vox-keep]) { visibility: hidden !important; }'
    + ' canvas { visibility: visible !important; }';
  document.head.appendChild(style);
  window.__voxKeepCount = n;
  return n;
};
const SHOW_UI = () => {
  document.getElementById('vox-hide-ui')?.remove();
  for (const el of document.querySelectorAll('[data-vox-keep]')) el.removeAttribute('data-vox-keep');
  return true;
};

// ------------------------------------------------------------------- harness
const browser = await chromium.launch({
  executablePath: path.join(pwDir, chromeDir, 'chrome-linux/chrome'),
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--window-size=1280,720']
});
const report = { capturedAt: new Date().toISOString(), base: BASE, mode: MODE,
  contractVersion: 'draft-v9',
  contractSha256: '0336a4f28bfaa874fffc300f02999e329dbed86d3cdcd53cf7ce3261c48639b1' };
const OUT = path.join(OUT_DIR, `ch10-v9-${MODE}.json`);
const flush = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n');

async function open(url, opts = {}) {
  const page = await browser.newPage({ viewport: opts.viewport ?? { width: 1280, height: 720 },
    isMobile: !!opts.isMobile, hasTouch: !!opts.isMobile,
    deviceScaleFactor: opts.deviceScaleFactor ?? 1,
    reducedMotion: opts.reducedMotion ?? 'no-preference' });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 180)));
  if (opts.initScript) await page.addInitScript(opts.initScript);
  await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 180000 });
  if (opts.resolveBeforeSettle) {
    await page.evaluate(RESOLVE).catch(e => errs.push('resolve ' + String(e).slice(0, 140)));
    await new Promise(r => setTimeout(r, opts.settle ?? 0));
  } else {
    await new Promise(r => setTimeout(r, opts.settle ?? 8000));
    await page.evaluate(RESOLVE).catch(e => errs.push('resolve ' + String(e).slice(0, 140)));
  }
  return { page, errs };
}

// =================================================================== strips
if (MODE === 'strips') {
  const STRIPS = [
    { id: 'strip-transit-a', reducedMotion: 'no-preference', settle: 0, resolveBeforeSettle: true,
      triggers: [
        { key: 'transit-ignite', pred: s => (s.av?.history ?? []).includes('anc.ch10.transit-ignite'),
          before: true, after: 2500 },
        { key: 'T2-hold-marker', pred: s => s.objectiveId === 'station:transit:hold' },
        { key: 'seam', pred: s => (s.av?.history ?? []).includes('anc.ch10.seam-of-light'),
          before: true, after: 3000 },
        { key: 'galaxy-absence-check', pred: s => s.milestones?.seamPassed === true,
          after: 4000, onlyAfter: true }
      ] },
    { id: 'strip-transit-b', reducedMotion: 'no-preference',
      triggers: [
        { key: 'station-resolved', pred: s => (s.av?.history ?? []).includes('anc.ch10.station-resolved'),
          before: true },
        { key: 'hold-mid', pred: () => true, delay: 1200 },
        { key: 'hold-release', pred: () => true, delay: 1400 },
        { key: 'K11-painted', pred: s => (s.caption ?? '').includes('both fires behind you') },
        { key: 'work-order-cleared', pred: s => !s.objectiveId },
        { key: 'threshold-handback', pred: s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback'),
          after: 4000 }
      ] },
    { id: 'strip-rm-transit', reducedMotion: 'reduce',
      triggers: [
        { key: 'seam', pred: s => (s.av?.history ?? []).includes('anc.ch10.seam-of-light'),
          before: true, after: 3000 },
        { key: 'station-resolved', pred: s => (s.av?.history ?? []).includes('anc.ch10.station-resolved') },
        { key: 'hold-mid', pred: () => true, delay: 1200 },
        { key: 'hold-release', pred: () => true, delay: 1400 },
        { key: 'threshold-handback', pred: s => (s.av?.history ?? []).includes('anc.ch10.threshold-handback'),
          after: 4000 }
      ] }
  ];
  const ONLY = (process.argv.find(a => a.startsWith('--strip=')) ?? '').split('=')[1] ?? null;
  report.strips = [];
  for (const spec of STRIPS.filter(s => !ONLY || s.id === ONLY)) {
    const dir = path.join(CAP_DIR, spec.id);
    const hideDir = path.join(SCRATCH, spec.id + '-cockpit-hidden');
    fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(hideDir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
    const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW',
      { settle: spec.settle ?? 6000, resolveBeforeSettle: !!spec.resolveBeforeSettle,
        reducedMotion: spec.reducedMotion });
    const frames = [];
    let idx = 0;
    const rec = { id: spec.id, url: '?story=ch10-transit&movie=1&profile=LOW', tier: 'LOW',
      viewport: '1280x720', reducedMotion: spec.reducedMotion === 'reduce',
      pageErrors: errs, frames };
    report.strips.push(rec);
    const note = (file, label, s, comp, hidden) => {
      frames.push({ file: `evidence/capture/${spec.id}/${file}`, label, t: s.t ?? null,
        beat: s.beat, objectiveId: s.objectiveId, markerLabel: s.markerLabel,
        health: s.health, hudText: s.hudText, caption: s.caption,
        controlMode: s.flight?.controlMode ?? null, phase: s.flight?.phase ?? null,
        speed: s.system?.speed ?? null,
        stationDistance: s.contacts?.stations?.[0]?.distance ?? null,
        anchorId: s.av?.anchorId ?? null, avFov: s.av?.fov ?? null,
        qualityProfile: s.qualityProfile ?? null,
        renderCameraFov: comp?.renderCamera?.fov ?? null,
        flightFeedbackFov: s.flightFeedback?.fov ?? null,
        flightBoost: s.flightFeedback?.boost ?? null,
        policyTargetFov: s.inputPolicy?.targetFov ?? null,
        cockpitShellLocalScale: comp?.cockpit?.shellLocalScale ?? null,
        viewport: comp?.viewport ?? null,
        stationSpine: comp?.stationSpine ?? null,
        instancedBatches: comp?.instancedBatches ?? null,
        stationGroupDistance: comp?.stationGroupDistance ?? null,
        stationHullInstances: comp?.stationHullInstances ?? null,
        stationLightInstances: comp?.stationLightInstances ?? null,
        skyGalaxyInFrame: (comp?.sky?.galaxy ?? []).filter(g => g.inFrame).length,
        skyCompanionsInFrame: (comp?.sky?.companions ?? []).filter(g => g.inFrame).length,
        masks: hidden });
      flush();
    };
    const shoot = async (label, s) => {
      const file = `${String(idx).padStart(2, '0')}_${label}_${s.beat ?? 'unknown'}.png`;
      idx++;
      await page.screenshot({ path: path.join(dir, file) });
      const comp = await page.evaluate(COMPOSE).catch(() => null);
      const hidden = await page.evaluate(MASKS).catch(e => ({ maskError: String(e).slice(0, 160) }));
      note(file, label, s, comp, hidden);
      const f = frames[frames.length - 1];
      console.log(`  [${spec.id}/${file}] dist=${f.stationDistance} phase=${f.phase}`
        + ` camFov=${f.renderCameraFov} flightFov=${f.flightFeedbackFov} shell=${JSON.stringify(f.cockpitShellLocalScale)}`
        + ` aperture=${f.masks?.cockpit?.apertureWidthAt1280} spine%=${f.masks?.station?.spinePercentOfFrameWidth}`);
    };
    const t0 = Date.now();
    let ti = 0, prevShot = null, prevState = null;
    while (ti < spec.triggers.length && (Date.now() - t0) / 1000 < 300) {
      const trig = spec.triggers[ti];
      if (trig.delay) {
        await new Promise(r => setTimeout(r, trig.delay));
        const s = await page.evaluate(READ);
        s.t = Number(((Date.now() - t0) / 1000).toFixed(2));
        await shoot(trig.key, s);
        ti++; prevShot = null; prevState = null;
        continue;
      }
      const s = await page.evaluate(READ).catch(() => null);
      if (!s) { await new Promise(r => setTimeout(r, 150)); continue; }
      s.t = Number(((Date.now() - t0) / 1000).toFixed(2));
      if (trig.pred(s)) {
        if (trig.before && prevShot) {
          const file = `${String(idx).padStart(2, '0')}_${trig.key}-before_${prevState.beat ?? 'unknown'}.png`;
          idx++;
          fs.writeFileSync(path.join(dir, file), prevShot);
          note(file, `${trig.key}-before`, prevState, prevComp, null);
        }
        if (!trig.onlyAfter) await shoot(trig.before ? `${trig.key}-at` : trig.key, s);
        if (trig.after) {
          await new Promise(r => setTimeout(r, trig.after));
          const s2 = await page.evaluate(READ);
          s2.t = Number(((Date.now() - t0) / 1000).toFixed(2));
          await shoot(trig.onlyAfter ? trig.key : `${trig.key}-after`, s2);
        }
        ti++; prevShot = null; prevState = null;
        continue;
      }
      prevShot = await page.screenshot();
      prevState = s;
      var prevComp = await page.evaluate(COMPOSE).catch(() => null);
      await new Promise(r => setTimeout(r, 200));
    }
    rec.frameCount = frames.length;
    rec.completedTriggers = ti;
    rec.allTriggersHit = ti === spec.triggers.length;
    flush();
    console.log(`[${spec.id}] frames=${frames.length} triggers=${ti}/${spec.triggers.length} errs=${errs.length}`);
    await page.close();
  }
}


// ===================================================================== seam
if (MODE === 'seam') {
  // The shutter is the frame where story:ch10-seam-passed LATCHES. Armed in
  // page on rAF: at 290 u/s one poll round-trip is ~60 units of closure, and
  // the latch window (5,100-5,200) is 100 units wide.
  const ARM = () => {
    window.__voxSeam = { armed: true, hit: null, frames: 0 };
    const spec = window.__voxSpec ?? {};
    const tick = async () => {
      const S = window.__voxSeam;
      if (!S?.armed) return;
      S.frames++;
      try {
        const st = await import(/* @vite-ignore */ spec.storyState);
        const pr = await import(/* @vite-ignore */ spec.progression);
        if (pr.hasMilestone(st.STORY_MILESTONES.ch10SeamPassed)) {
          S.armed = false;
          S.hit = { at: Math.round(performance.now()), frames: S.frames,
            distance: (window.__spaceStationContacts?.()?.stations?.[0]?.distance) ?? null };
          return;
        }
      } catch { /* ignore */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  };
  report.stills = [];
  for (const tier of ['HIGH', 'LOW']) {
    const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW',
      { settle: 0, resolveBeforeSettle: true });
    const rec = { tier, pageErrors: errs };
    report.stills.push(rec);
    if (tier === 'HIGH') {
      // warm the pipeline early: raise at ignite, long before the latch window
      const t0 = Date.now();
      while ((Date.now() - t0) / 1000 < 180) {
        const s = await page.evaluate(READ).catch(() => null);
        if (s && (s.contacts?.stations?.[0]?.distance ?? 1e9) < 6200) break;
        await new Promise(r => setTimeout(r, 400));
      }
      rec.raisedAtDistance = (await page.evaluate(READ)).contacts?.stations?.[0]?.distance ?? null;
      rec.appliedProfile = await page.evaluate(SET_PROFILE, 'HIGH').catch(e => String(e).slice(0, 90));
    }
    await page.evaluate(ARM).catch(e => rec.armError = String(e).slice(0, 120));
    const t1 = Date.now();
    let hit = null;
    while ((Date.now() - t1) / 1000 < 300) {
      hit = await page.evaluate(() => window.__voxSeam?.hit ?? null).catch(() => null);
      if (hit) break;
      await new Promise(r => setTimeout(r, 120));
    }
    const file = tier === 'HIGH' ? 'still-seam-of-light.png' : 'still-seam-of-light-low.png';
    await page.screenshot({ path: path.join(CAP_DIR, file) });
    rec.uiRects = await page.evaluate(UI_RECTS).catch(() => null);
    rec.uiHidden = await page.evaluate(HIDE_UI).catch(() => null);
    const sceneFile = file.replace('.png', '-scene.png');
    await page.screenshot({ path: path.join(CAP_DIR, sceneFile) });
    rec.sceneFile = `evidence/capture/${sceneFile}`;
    await page.evaluate(SHOW_UI).catch(() => {});
    const at = await page.evaluate(READ).catch(() => ({}));
    const comp = await page.evaluate(COMPOSE).catch(() => null);
    const masks = await page.evaluate(MASKS).catch(e => ({ maskError: String(e).slice(0, 120) }));
    rec.file = `evidence/capture/${file}`;
    rec.latch = hit;
    rec.distanceAtShutter = at.contacts?.stations?.[0]?.distance ?? null;
    rec.rangeSpec = [5100, 5200];
    rec.qualityProfile = at.qualityProfile ?? null;
    rec.renderCameraFov = comp?.renderCamera?.fov ?? null;
    rec.stationSpineGeom = comp?.stationSpine ?? null;
    rec.spineLaw = comp?.spineLaw ?? null;
    rec.hullPickedBy = comp?.hullPickedBy ?? null;
    rec.exteriorDiag = comp?.exteriorDiag ?? null;
    rec.hullPickAgreesWithDiag = comp?.hullPickAgreesWithDiag ?? null;
    rec.laneAssertion = { href: at.href ?? null, lane: at.lane ?? null };
    rec.stationMask = masks?.station ?? null;
    rec.cockpitMask = masks?.cockpit ?? null;
    rec.cockpitMaskPackedBase64 = masks?.cockpitMaskPackedBase64 ?? null;
    rec.cockpitMaskSize = masks?.cockpitMaskSize ?? null;
    rec.stationMaskPackedBase64 = masks?.stationMaskPackedBase64 ?? null;
    rec.galaxyInFrame = (comp?.sky?.galaxy ?? []).filter(g => g.inFrame).length;
    rec.companionsInFrame = (comp?.sky?.companions ?? []).filter(g => g.inFrame).length;
    rec.flightPhase = at.flight?.phase ?? null;
    rec.milestones = at.milestones ?? null;
    rec.beat = at.beat ?? null;
    flush();
    console.log(`[seam ${tier}] latchDist=${hit?.distance} shutterDist=${rec.distanceAtShutter}`
      + ` spinePx=${rec.stationMask?.spineLengthPx} spineDeg=${rec.stationMask?.spineVisualAngleDeg}`
      + ` thickDeg=${rec.stationMask?.thicknessVisualAngleDeg}`
      + ` offCenterDeg=${rec.stationMask?.centroidOffsetFromViewCenterDeg} galaxy=${rec.galaxyInFrame}`);
    await page.close();
  }
}

// ==================================================================== cutline
if (MODE === 'cutline') {
  const ARM = () => {
    window.__voxCut = { armed: true, hit: null };
    const spec = window.__voxSpec ?? {};
    const tick = async () => {
      const C = window.__voxCut;
      if (!C?.armed) return;
      try {
        const av = await import(/* @vite-ignore */ spec.signedAv);
        const s = av.getSignedSceneAvDebugSnapshot();
        const hb = (s.activationHistoryAnchorIds ?? []).includes('anc.ch10.threshold-handback');
        const cap = document.querySelector('[data-story-caption]');
        const k11 = (cap?.innerText ?? '').includes('both fires behind you');
        const hud = document.querySelector('[data-story-guidance-hud]');
        if (hb && k11 && !hud?.getAttribute('data-objective-id')) {
          C.armed = false;
          C.hit = { at: Math.round(performance.now()),
            distance: (window.__spaceStationContacts?.()?.stations?.[0]?.distance) ?? null };
          return;
        }
      } catch { /* ignore */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return true;
  };
  const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW', { settle: 7000 });
  report.pageErrors = errs;
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < 180) {
    const s = await page.evaluate(READ).catch(() => null);
    if (s && (s.av?.history ?? []).includes('anc.ch10.seam-of-light')) break;
    await new Promise(r => setTimeout(r, 400));
  }
  report.raisedAtDistance = (await page.evaluate(READ)).contacts?.stations?.[0]?.distance ?? null;
  report.appliedProfile = await page.evaluate(SET_PROFILE, 'HIGH').catch(e => String(e).slice(0, 90));
  await page.evaluate(ARM).catch(e => report.armError = String(e).slice(0, 120));
  const t1 = Date.now();
  let hit = null;
  while ((Date.now() - t1) / 1000 < 300) {
    hit = await page.evaluate(() => window.__voxCut?.hit ?? null).catch(() => null);
    if (hit) break;
    await new Promise(r => setTimeout(r, 100));
  }
  await page.screenshot({ path: path.join(CAP_DIR, 'still-station-resolved.png') });
  report.uiRects = await page.evaluate(UI_RECTS).catch(() => null);
  report.uiHidden = await page.evaluate(HIDE_UI).catch(() => null);
  await page.screenshot({ path: path.join(CAP_DIR, 'still-station-resolved-scene.png') });
  report.sceneFile = 'evidence/capture/still-station-resolved-scene.png';
  await page.evaluate(SHOW_UI).catch(() => {});
  const at = await page.evaluate(READ).catch(() => ({}));
  const comp = await page.evaluate(COMPOSE).catch(() => null);
  const masks = await page.evaluate(MASKS).catch(e => ({ maskError: String(e).slice(0, 120) }));
  report.still = { id: 'still-station-resolved', file: 'evidence/capture/still-station-resolved.png',
    tier: at.qualityProfile ?? null, armedAt: hit,
    rangeSpec: [1000, 1300], rangeAtShutter: at.contacts?.stations?.[0]?.distance ?? null,
    stationCentreRange: comp?.stationGroupDistance ?? null,
    renderCameraFov: comp?.renderCamera?.fov ?? null, avFov: at.av?.fov ?? null,
    spineSpec: [22.0, 28.7], spineLaw: comp?.spineLaw ?? null,
    hullPickedBy: comp?.hullPickedBy ?? null, exteriorDiag: comp?.exteriorDiag ?? null,
    hullPickAgreesWithDiag: comp?.hullPickAgreesWithDiag ?? null,
    stationMask: masks?.station ?? null,
    stationSpineGeom: comp?.stationSpine ?? null, cockpitMask: masks?.cockpit ?? null,
    cockpitMaskPackedBase64: masks?.cockpitMaskPackedBase64 ?? null,
    cockpitMaskSize: masks?.cockpitMaskSize ?? null,
    stationMaskPackedBase64: masks?.stationMaskPackedBase64 ?? null,
    stationHullInstances: comp?.stationHullInstances ?? null,
    stationLightInstances: comp?.stationLightInstances ?? null,
    k11Painted: (at.caption ?? '').includes('both fires behind you'),
    caption: at.caption ?? null, objectiveId: at.objectiveId ?? null,
    hudText: at.hudText ?? null, resetReason: at.av?.reset ?? null,
    galaxyInFrame: (comp?.sky?.galaxy ?? []).filter(g => g.inFrame).length,
    companionsInFrame: (comp?.sky?.companions ?? []).filter(g => g.inFrame).length,
    canDock: at.contacts?.stations?.[0]?.canDock ?? null,
    dockingAuthorized: at.milestones?.dockingAuthorized ?? null, state: at };
  // Diagnostic coast trace: the contract derives the [1,000-1,300] window from
  // "thrust cut at 1,500, closure ~80 u/s". Record where the window actually
  // falls after the hand-back so the deviation is auditable rather than argued.
  const coast = [];
  const tc = Date.now();
  while ((Date.now() - tc) / 1000 < 14) {
    const r = await page.evaluate(READ).catch(() => null);
    const c = await page.evaluate(COMPOSE).catch(() => null);
    const m = await page.evaluate(MASKS).catch(() => null);
    if (r) coast.push({ t: Number(((Date.now() - tc) / 1000).toFixed(2)),
      contactDistance: r.contacts?.stations?.[0]?.distance ?? null,
      spineLawZ: c?.spineLaw?.Z ?? null, K: c?.spineLaw?.K ?? null,
      predictedPercent: c?.spineLaw?.predictedOccupancyPercent ?? null,
      measuredPercent: m?.station?.spinePercentOfFrameWidth ?? null,
      fov: c?.renderCamera?.fov ?? null,
      speed: r.system?.speed ?? null });
    await new Promise(r2 => setTimeout(r2, 700));
  }
  report.coastTrace = coast;
  flush();
  console.log(`[cutline] dist=${report.still.rangeAtShutter} centre=${report.still.stationCentreRange}`
    + ` fov=${report.still.renderCameraFov} spine%=${masks?.station?.spinePercentOfFrameWidth}`
    + ` hull=${report.still.stationHullInstances} lights=${report.still.stationLightInstances}`
    + ` k11=${report.still.k11Painted} obj=${report.still.objectiveId}`);
  await page.close();
}

// ================================================================== st0cross
if (MODE === 'st0cross') {
  const dir = path.join(CAP_DIR, 'strip-st0-crossing');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  const { page, errs } = await open('?story=ch10-cold&movie=1&profile=LOW', { settle: 12000 });
  report.pageErrors = errs;
  const HOLD_NIGHT = async () => {
    const c = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).worldClock);
    const n = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).nightState);
    const TARGET = 0.62;
    c.setDayPhaseOffset(c.getDayPhaseOffset() + (TARGET - c.getCurrentDayPhase()));
    return { phase: c.getCurrentDayPhase(), daylight: n.daylightFromDayPhase(c.getCurrentDayPhase()) };
  };
  const ST0 = () => {
    const w = window, THREE = w.__THREE;
    const { scene, camera } = w.__voxPick();
    if (!scene || !camera || !THREE) return null;
    camera.updateMatrixWorld(true);
    let st0 = null;
    scene.traverse(o => { if (o.name === 'system-st0-station-light') st0 = o; });
    if (!st0) return { present: false };
    const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
    const wp = new THREE.Vector3(); st0.getWorldPosition(wp);
    const up = camPos.clone().normalize();
    const dir = wp.clone().sub(camPos).normalize();
    const ndc = wp.clone().project(camera);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    return { present: true, visible: st0.visible, opacity: st0.material?.opacity ?? null,
      altitudeDeg: Number((90 - Math.acos(Math.max(-1, Math.min(1, dir.dot(up)))) * 180 / Math.PI).toFixed(3)),
      ndc: [Number(ndc.x.toFixed(4)), Number(ndc.y.toFixed(4))],
      inFrustum: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
      offAxisDeg: Number((Math.acos(Math.max(-1, Math.min(1, dir.dot(fwd)))) * 180 / Math.PI).toFixed(3)),
      depthTest: st0.material?.depthTest ?? null, depthWrite: st0.material?.depthWrite ?? null,
      renderOrder: st0.renderOrder, frustumCulled: st0.frustumCulled,
      quadScale: Number((st0.scale?.x ?? 0).toFixed(4)),
      distance: Number(camPos.distanceTo(wp).toFixed(1)),
      cameraFov: camera.fov };
  };
  await page.evaluate(HOLD_NIGHT).catch(() => {});
  const samples = [];
  const t0 = Date.now();
  let held = Date.now();
  const SAMPLE_TARGET = 432, PERIOD_MS = 500;
  while (samples.length < SAMPLE_TARGET && (Date.now() - t0) / 1000 < 320) {
    if (Date.now() - held > 6000) { await page.evaluate(HOLD_NIGHT).catch(() => {}); held = Date.now(); }
    const s = await page.evaluate(ST0).catch(() => null);
    if (s && s.present) samples.push({ t: Number(((Date.now() - t0) / 1000).toFixed(2)), ...s });
    await new Promise(r => setTimeout(r, PERIOD_MS));
  }
  report.traceSamples = samples.length;
  report.inFrustumSamples = samples.filter(s => s.inFrustum).length;
  report.inFrustumSamplesRequired = 60;
  report.visibleSamples = samples.filter(s => s.visible).length;
  report.aboveHorizonSamples = samples.filter(s => s.altitudeDeg > 0).length;
  const vis = samples.filter(s => s.altitudeDeg != null);
  const peaks = [];
  for (let i = 2; i < vis.length - 2; i++) {
    const a = vis[i].altitudeDeg;
    if (a > vis[i - 1].altitudeDeg && a > vis[i - 2].altitudeDeg
      && a >= vis[i + 1].altitudeDeg && a >= vis[i + 2].altitudeDeg && a > 0) {
      if (!peaks.length || vis[i].t - peaks[peaks.length - 1].t > 40) peaks.push(vis[i]);
    }
  }
  report.peaks = peaks.map(p => ({ t: p.t, alt: p.altitudeDeg }));
  report.peakIntervalsSeconds = peaks.slice(1).map((p, i) => Number((p.t - peaks[i].t).toFixed(2)));
  report.consecutivePeriodsProven = Math.max(0, peaks.length - 1);
  report.trace = samples;
  flush();
  // --- the eight strip frames, event-selected off the live phase -----------
  const wantFrames = [
    ['00_pre-rise', s => s.altitudeDeg < 0 && s.altitudeDeg > -8],
    ['01_rise', s => s.altitudeDeg >= 0 && s.altitudeDeg < 3],
    ['02_arc-a', s => s.altitudeDeg >= 6 && s.altitudeDeg < 11],
    ['03_arc-b-true-bearing', s => s.altitudeDeg >= 13],
    ['04_arc-c', s => s.altitudeDeg >= 6 && s.altitudeDeg < 11],
    ['05_set', s => s.altitudeDeg >= -1 && s.altitudeDeg < 2],
    ['06_post-set', s => s.altitudeDeg < -3],
    ['07_next-rise', s => s.altitudeDeg >= 0 && s.altitudeDeg < 3]
  ];
  const shots = [];
  let wi = 0;
  const t1 = Date.now();
  let held2 = Date.now();
  let prevAlt = null;
  while (wi < wantFrames.length && (Date.now() - t1) / 1000 < 400) {
    if (Date.now() - held2 > 6000) { await page.evaluate(HOLD_NIGHT).catch(() => {}); held2 = Date.now(); }
    const s = await page.evaluate(ST0).catch(() => null);
    if (!s || !s.present) { await new Promise(r => setTimeout(r, 300)); continue; }
    const [label, pred] = wantFrames[wi];
    const rising = prevAlt == null ? true : s.altitudeDeg >= prevAlt;
    prevAlt = s.altitudeDeg;
    const wantRising = wi <= 3 || wi === 7;
    if (pred(s) && (wi === 0 || wi === 6 || rising === wantRising)) {
      const at = await page.evaluate(READ).catch(() => ({}));
      const file = `${label}_${at.beat ?? 'unknown'}.png`;
      await page.screenshot({ path: path.join(dir, file) });
      shots.push({ file: `evidence/capture/strip-st0-crossing/${file}`, label,
        t: Number(((Date.now() - t1) / 1000).toFixed(2)), beat: at.beat ?? null,
        altitudeDeg: s.altitudeDeg, ndc: s.ndc, inFrustum: s.inFrustum,
        offAxisDeg: s.offAxisDeg, visible: s.visible, opacity: s.opacity,
        depthTest: s.depthTest, renderOrder: s.renderOrder, distance: s.distance,
        cameraFov: s.cameraFov, isNight: at.isNight ?? null });
      wi++;
      flush();
      console.log(`  [st0 ${label}] alt=${s.altitudeDeg} inFrustum=${s.inFrustum} ndc=${JSON.stringify(s.ndc)}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }
  report.stripFrames = shots;
  report.stripFrameCount = shots.length;
  report.stripInFrustumFrames = shots.filter(s => s.inFrustum).length;
  report.stripInFrustumRequired = 4;
  flush();
  console.log(`[st0cross] frames=${shots.length} inFrustumFrames=${report.stripInFrustumFrames}/8`
    + ` inFrustumSamples=${report.inFrustumSamples}/${samples.length}`
    + ` periods=${report.consecutivePeriodsProven}`);
  await page.close();
}

// ======================================================================= ux1
if (MODE === 'ux1') {
  // UX-1: after the bearing claim ON FOOT a locator to the Kestrel must exist
  // with the exact label; ignite must never publish on foot; boarding replaces
  // reboard with ignite; disembarking pre-ignition returns to reboard with
  // exactly one fresh cue. Manual lane (no movie=1) on both entry paths.
  const STEP = async (what) => {
    const spec = window.__voxSpec ?? {};
    const sf = await import(/* @vite-ignore */ spec.spaceFlight);
    if (what === 'board') return sf.enterShip();
    if (what === 'exit') return sf.exitShip();
    return null;
  };
  const CUES = () => (window.__voxFeedbackLog ?? []).map(e => ({ at: e.at,
    id: e.cue?.objectiveId ?? e.cue?.id ?? null, kind: e.cue?.kind ?? null, beat: e.beat }));
  report.paths = [];
  for (const url of ['?story=ch10-transit&profile=LOW', '?story=ch10-ask&profile=LOW']) {
    const { page, errs } = await open(url, { settle: 14000 });
    const rec = { url, lane: 'manual (no movie=1)', pageErrors: errs, steps: [] };
    report.paths.push(rec);
    const snap = async (label) => {
      const s = await page.evaluate(READ).catch(() => ({}));
      const cues = await page.evaluate(CUES).catch(() => []);
      const row = { label, beat: s.beat, objectiveId: s.objectiveId, markerLabel: s.markerLabel,
        health: s.health, requiresMarker: s.requiresMarker, hudText: s.hudText,
        guidance: s.guidance ?? null, aboard: s.flight?.controlMode === 'flight',
        flightPhase: s.flight?.phase ?? null, milestones: s.milestones ?? null,
        cueCount: cues.length, cues };
      rec.steps.push(row); flush();
      console.log(`  [${url} ${label}] obj=${row.objectiveId} marker="${row.markerLabel}"`
        + ` health=${row.health} aboard=${row.aboard} cues=${row.cueCount}`
        + ` order="${(row.guidance?.workOrder ?? []).join(' / ')}"`);
      return row;
    };
    // wait for the ladder to settle (the deep link reconstructs the habitat)
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < 90) {
      const s = await page.evaluate(READ).catch(() => null);
      if (s?.guidance?.objectiveId) break;
      await new Promise(r => setTimeout(r, 500));
    }
    await snap('entry');
    if (url.includes('ch10-ask')) {
      // drive the ask ladder to the claim is out of scope for the manual lane;
      // record what the deep link actually publishes and its marker health.
      await new Promise(r => setTimeout(r, 4000));
      await snap('ask-settled');
    } else {
      await snap('on-foot-after-claim');
      await page.evaluate(STEP, 'board').catch(() => null);
      await new Promise(r => setTimeout(r, 2500));
      await snap('boarded');
      await page.evaluate(STEP, 'exit').catch(() => null);
      await new Promise(r => setTimeout(r, 2500));
      await snap('disembarked-pre-ignition');
      await page.evaluate(STEP, 'board').catch(() => null);
      await new Promise(r => setTimeout(r, 2500));
      await snap('reboarded');
    }
    await page.close();
  }
}

// ================================================================== variants
if (MODE === 'variants') {
  const PROFILES = [
    { id: 'desktop-high', profile: 'HIGH', viewport: { width: 1280, height: 720 } },
    { id: 'desktop-medium-rm', profile: 'MEDIUM', reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } },
    { id: 'desktop-low', profile: 'LOW', viewport: { width: 1280, height: 720 } },
    { id: 'mobile-potato', profile: 'POTATO', isMobile: true, viewport: { width: 390, height: 844 } }
  ];
  const BEATS = ['ch10-cold', 'ch10-ask', 'ch10-transit'];
  report.matrix = [];
  for (const lane of ['movie', 'manual']) {
    for (const p of PROFILES) {
      for (const beat of BEATS) {
        if (lane === 'manual' && p.id !== 'desktop-low') continue;
        const url = `?story=${beat}${lane === 'movie' ? '&movie=1' : ''}&profile=${p.profile}`;
        const { page, errs } = await open(url, { settle: 14000, viewport: p.viewport,
          isMobile: p.isMobile, reducedMotion: p.reducedMotion });
        const t0 = Date.now();
        let s = null;
        while ((Date.now() - t0) / 1000 < 60) {
          s = await page.evaluate(READ).catch(() => null);
          if (s?.guidance?.objectiveId) break;
          await new Promise(r => setTimeout(r, 500));
        }
        s = s ?? await page.evaluate(READ).catch(() => ({}));
        const comp = await page.evaluate(COMPOSE).catch(() => null);
        const masks = p.id === 'mobile-potato'
          ? await page.evaluate(MASKS).catch(() => null) : null;
        const row = { lane, profile: p.id, beat, url,
          appliedProfile: s.qualityProfile ?? null,
          beatObserved: s.beat ?? null,
          objectiveId: s.objectiveId ?? null, feedObjectiveId: s.feedObjectiveId ?? null,
          markerLabel: s.markerLabel ?? null, health: s.health ?? null,
          feedHealth: s.feedHealth ?? null, requiresMarker: s.requiresMarker ?? null,
          hudText: s.hudText ?? null, feedText: s.feedText ?? null,
          guidance: s.guidance ?? null,
          avFov: s.av?.fov ?? null, renderCameraFov: comp?.renderCamera?.fov ?? null,
          resetReason: s.av?.reset ?? null, postFx: s.av?.postFx ?? [],
          mobileCockpitAperture: masks?.cockpit?.apertureWidthPx ?? null,
          mobileCockpitBBox: masks?.cockpit?.silhouetteBBox ?? null,
          mobileBuffer: masks?.bufferSize ?? null,
          mobileCockpitOccupancyPercentOfFrameArea: masks?.cockpit?.maskPixels && masks?.bufferSize
            ? Number(((masks.cockpit.maskPixels / (masks.bufferSize[0] * masks.bufferSize[1])) * 100).toFixed(2))
            : null,
          pageErrors: errs };
        report.matrix.push(row); flush();
        console.log(`  [${lane}/${p.id}/${beat}] obj=${row.objectiveId ?? row.feedObjectiveId}`
          + ` health=${row.health ?? row.feedHealth} marker="${row.markerLabel}" fov=${row.avFov}`
          + ` mobileOcc=${row.mobileCockpitOccupancyPercentOfFrameArea}`);
        await page.close();
      }
    }
  }
  const mandatory = report.matrix.filter(r => r.requiresMarker === 'true' || r.guidance?.requiresMarker === true);
  report.mandatoryRungsAtMissingMarker = mandatory.filter(r =>
    (r.health ?? r.feedHealth) === 'missing-marker').length;
  report.deferredRungsReadingIdle = report.matrix.filter(r =>
    !r.objectiveId && (r.feedHealth === 'idle' || r.feedText)).length;
  flush();
}

// ===================================================================== berth
if (MODE === 'berth') {
  const EXTERIOR = async () => {
    const spec = window.__voxSpec ?? {};
    let exSpec = spec.exterior;
    if (!exSpec) {
      const src = await (await fetch('/src/components/spaceStation/SpaceStationExterior.tsx')).text();
      const m2 = [...src.matchAll(/from\s*["']([^"']+)["']/g)]
        .map(x => x[1]).find(u => /spaceStationExterior\.ts/.test(u));
      exSpec = m2;
    }
    const ex = exSpec ? await import(/* @vite-ignore */ exSpec) : null;
    let devSpec = spec.devFlag;
    if (!devSpec) {
      const src = await (await fetch('/src/components/SystemSpaceStations.tsx')).text();
      devSpec = [...src.matchAll(/from\s*["']([^"']+)["']/g)]
        .map(x => x[1]).find(u => /spaceStationDevFlag\.ts/.test(u));
    }
    const dev = devSpec ? await import(/* @vite-ignore */ devSpec) : null;
    const out = { dockingAuthorized: dev?.spaceStationDockingAuthorized
      ? dev.spaceStationDockingAuthorized() : null };
    try {
      const built = ex && ex.buildSpaceStationExterior ? ex.buildSpaceStationExterior({}, 1) : null;
      out.builderProbe = built ? { boxes: built.boxes.length, lights: built.lights.length,
        dockOfferBoxes: built.boxes.filter(b => b.dockOffer).length,
        dockOfferLights: built.lights.filter(l => l.dockOffer).length } : null;
    } catch (e) { out.builderError = String(e).slice(0, 120); }
    return out;
  };
  const COUNTS = () => {
    const w = window;
    const { scene, camera } = w.__voxPick();
    if (!scene || !camera) return null;
    const THREE = w.__THREE;
    const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
    const groups = new Map();
    scene.traverse(o => {
      if (!o.isInstancedMesh) return;
      let banned = false;
      for (let x = o; x; x = x.parent) if (/companion|galaxy|impostor|st0|star/i.test(x.name || '')) banned = true;
      if (banned) return;
      const p = o.parent; if (!p) return;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(o);
    });
    const rows = [];
    for (const [g, ms] of groups.entries()) {
      if (ms.length < 2) continue;
      const gp = new THREE.Vector3(); g.getWorldPosition(gp);
      rows.push({ distance: Number(gp.distanceTo(camPos).toFixed(1)),
        counts: ms.map(m => m.count).sort((a, b) => b - a) });
    }
    rows.sort((a, b) => a.distance - b.distance);
    return rows.slice(0, 6);
  };
  report.cases = [];
  for (const c of [
    { id: 'story-transit', url: '?story=ch10-transit&movie=1&profile=LOW', wait: 'seam' },
    { id: 'sandbox', url: '?spacestation=1&profile=LOW', wait: null }
  ]) {
    const { page, errs } = await open(c.url, { settle: 12000 });
    const rec = { id: c.id, url: c.url, pageErrors: errs };
    report.cases.push(rec);
    if (c.wait === 'seam') {
      const t0 = Date.now();
      while ((Date.now() - t0) / 1000 < 200) {
        const s = await page.evaluate(READ).catch(() => null);
        if (s && (s.contacts?.stations?.[0]?.distance ?? 1e9) < 1600) break;
        await new Promise(r => setTimeout(r, 400));
      }
    }
    rec.exterior = await page.evaluate(EXTERIOR).catch(e => ({ error: String(e).slice(0, 140) }));
    rec.instanceGroups = await page.evaluate(COUNTS).catch(() => null);
    const at = await page.evaluate(READ).catch(() => ({}));
    rec.stationDistance = at.contacts?.stations?.[0]?.distance ?? null;
    rec.dockingMilestone = at.milestones?.dockingAuthorized ?? null;
    const f = `berth-${c.id}.png`;
    await page.screenshot({ path: path.join(SCRATCH, f) });
    rec.frame = path.join(SCRATCH, f);
    flush();
    console.log(`  [berth ${c.id}] dist=${rec.stationDistance} groups=${JSON.stringify(rec.instanceGroups)}`
      + ` auth=${JSON.stringify(rec.exterior)}`);
    await page.close();
  }
}

// ====================================================================== occl
if (MODE === 'occl') {
  const ST0PIX = async () => {
    const w = window, THREE = w.__THREE;
    const spec = w.__voxSpec ?? {};
    const { scene, camera } = w.__voxPick();
    const gl = w.__voxRoot?.getState?.()?.gl ?? w.__voxRenderer ?? null;
    let st0 = null;
    scene?.traverse(o => { if (o.name === 'system-st0-station-light') st0 = o; });
    const out = { present: !!st0, dpr: window.devicePixelRatio,
      buffer: gl ? [gl.domElement.width, gl.domElement.height] : null,
      cssSize: [window.innerWidth, window.innerHeight] };
    try {
      const g = await import(/* @vite-ignore */ spec.graphics);
      out.qualityProfile = g.getQualityProfile();
    } catch { /* ignore */ }
    if (!st0 || !camera) return out;
    const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
    const wp = new THREE.Vector3(); st0.getWorldPosition(wp);
    const dist = camPos.distanceTo(wp);
    out.material = { depthTest: st0.material?.depthTest ?? null,
      depthWrite: st0.material?.depthWrite ?? null, transparent: st0.material?.transparent ?? null };
    out.renderOrder = st0.renderOrder;
    out.frustumCulled = st0.frustumCulled;
    out.quadScale = Number((st0.scale?.x ?? 0).toFixed(5));
    out.distance = Number(dist.toFixed(1));
    out.visible = st0.visible;
    out.opacity = st0.material?.opacity ?? null;
    try {
      const m = await import(/* @vite-ignore */ spec.companion);
      // The runtime builds the quad from gl.getDrawingBufferSize().y with a DPR
      // argument of 1 (the buffer height is already device pixels). Measuring
      // with window.innerHeight/devicePixelRatio describes a lens nobody renders.
      const THREE2 = window.__THREE;
      const H = gl ? gl.getDrawingBufferSize(new THREE2.Vector2()).y : window.innerHeight;
      out.drawingBufferHeight = H;
      out.deviceProjectedPixels = Number(m.st0DeviceProjectedPixels(
        st0.scale.x, dist, (camera.fov * Math.PI) / 180, H, 1).toFixed(4));
      out.deviceProjectedPixelsAtCssHeight = Number(m.st0DeviceProjectedPixels(
        st0.scale.x, dist, (camera.fov * Math.PI) / 180,
        window.innerHeight, window.devicePixelRatio).toFixed(4));
      out.ST0_MAX_PIXELS = m.ST0_MAX_PIXELS;
      out.bufferHeight = H;
    } catch (e) { out.pixelError = String(e).slice(0, 140); }
    return out;
  };
  const PROFILES = [
    { id: 'desktop-high', profile: 'HIGH', viewport: { width: 1280, height: 720 } },
    { id: 'desktop-medium-rm', profile: 'MEDIUM', reducedMotion: 'reduce', viewport: { width: 1280, height: 720 } },
    { id: 'desktop-low', profile: 'LOW', viewport: { width: 1280, height: 720 } },
    { id: 'mobile-potato', profile: 'POTATO', isMobile: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } }
  ];
  report.profiles = [];
  for (const p of PROFILES) {
    const { page, errs } = await open(`?story=ch10-cold&profile=${p.profile}`,
      { settle: 14000, viewport: p.viewport, isMobile: p.isMobile,
        reducedMotion: p.reducedMotion, deviceScaleFactor: p.deviceScaleFactor });
    const HOLD_NIGHT = async () => {
      const c = await import(/* @vite-ignore */ (window.__voxSpec ?? {}).worldClock);
      c.setDayPhaseOffset(c.getDayPhaseOffset() + (0.62 - c.getCurrentDayPhase()));
      return c.getCurrentDayPhase();
    };
    await page.evaluate(HOLD_NIGHT).catch(() => {});
    await new Promise(r => setTimeout(r, 2500));
    const rows = [];
    for (let i = 0; i < 12; i++) {
      await page.evaluate(HOLD_NIGHT).catch(() => {});
      const r = await page.evaluate(ST0PIX).catch(e => ({ error: String(e).slice(0, 140) }));
      rows.push(r);
      await new Promise(r2 => setTimeout(r2, 1500));
    }
    const px = rows.map(r => r.deviceProjectedPixels).filter(n => typeof n === 'number');
    report.profiles.push({ id: p.id, requestedProfile: p.profile, pageErrors: errs,
      samples: rows.length, maxDeviceProjectedPixels: px.length ? Math.max(...px) : null,
      minDeviceProjectedPixels: px.length ? Math.min(...px) : null,
      ceiling: rows.find(r => r.ST0_MAX_PIXELS)?.ST0_MAX_PIXELS ?? null,
      depthTest: rows.find(r => r.material)?.material?.depthTest ?? null,
      renderOrder: rows.find(r => r.renderOrder != null)?.renderOrder ?? null,
      frustumCulled: rows.find(r => r.frustumCulled != null)?.frustumCulled ?? null,
      rows });
    flush();
    const last = report.profiles[report.profiles.length - 1];
    console.log(`  [occl ${p.id}] maxPx=${last.maxDeviceProjectedPixels} ceiling=${last.ceiling}`
      + ` depthTest=${last.depthTest} renderOrder=${last.renderOrder}`);
    await page.close();
  }
}

// ======================================================================= da6
if (MODE === 'da6') {
  // MANUAL flight: thrust suppressed for HOLD_DURATION_MS from the resolve
  // anchor while attitude and look stay live; suppression ends at the hand-back.
  const { page, errs } = await open('?story=ch10-transit&movie=1&profile=LOW', { settle: 7000 });
  report.pageErrors = errs;
  const SAMPLE = async () => {
    const spec = window.__voxSpec ?? {};
    const p = await import(/* @vite-ignore */ spec.inputPolicy);
    const av = await import(/* @vite-ignore */ spec.signedAv);
    const sf = await import(/* @vite-ignore */ spec.systemFlight);
    const s = av.getSignedSceneAvDebugSnapshot();
    const v = sf.getSystemFlightSnapshot();
    return { at: Math.round(performance.now()),
      moveSpeedScale: p.getStoryInputPolicy().moveSpeedScale ?? null,
      history: s.activationHistoryAnchorIds ?? [],
      beat: window.__storyBeat ?? null,
      speed: Number(Math.hypot(...(v.pose?.velocity ?? [0, 0, 0])).toFixed(2)),
      quat: (v.pose?.quaternion ?? []).map(n => Number(n.toFixed(4))) };
  };
  const rows = [];
  const t0 = Date.now();
  let resolvedAt = null, handbackAt = null;
  while ((Date.now() - t0) / 1000 < 200) {
    const r = await page.evaluate(SAMPLE).catch(() => null);
    if (r) {
      rows.push(r);
      if (!resolvedAt && r.history.includes('anc.ch10.station-resolved')) resolvedAt = r.at;
      if (!handbackAt && r.history.includes('anc.ch10.threshold-handback')) { handbackAt = r.at; }
    }
    if (handbackAt && (Date.now() - t0) > 0 && rows.length > 4
      && rows[rows.length - 1].at - handbackAt > 2500) break;
    await new Promise(r2 => setTimeout(r2, 120));
  }
  // Manual thrust attempt inside the hold: press W and see whether speed rises.
  report.trace = rows;
  report.resolvedAtMs = resolvedAt; report.handbackAtMs = handbackAt;
  report.holdDurationMs = handbackAt && resolvedAt ? handbackAt - resolvedAt : null;
  report.holdSpec = 2500;
  const inHold = rows.filter(r => resolvedAt && handbackAt && r.at >= resolvedAt && r.at < handbackAt);
  const afterHold = rows.filter(r => handbackAt && r.at >= handbackAt);
  report.moveScaleDuringHold = [...new Set(inHold.map(r => r.moveSpeedScale))];
  report.moveScaleAfterHandback = [...new Set(afterHold.map(r => r.moveSpeedScale))];
  report.attitudeChangedDuringHold = inHold.length > 1
    && JSON.stringify(inHold[0].quat) !== JSON.stringify(inHold[inHold.length - 1].quat);
  report.speedDuringHold = inHold.map(r => r.speed);
  flush();
  // manual-lane assertion of the suppression branch itself
  const MANUAL = async () => {
    const spec = window.__voxSpec ?? {};
    const src = await (await fetch('/src/components/ShipController.tsx')).text();
    const i = src.indexOf('const thrustHeld');
    return { branchPresent: i >= 0, snippet: i >= 0 ? src.slice(i, i + 260) : null };
  };
  report.shipControllerBranch = await page.evaluate(MANUAL).catch(e => String(e).slice(0, 140));
  console.log(`[da6] hold=${report.holdDurationMs}ms scaleInHold=${JSON.stringify(report.moveScaleDuringHold)}`
    + ` scaleAfter=${JSON.stringify(report.moveScaleAfterHandback)}`
    + ` attitudeLive=${report.attitudeChangedDuringHold}`);
  await page.close();
}

// ======================================================================= e2e
if (MODE === 'e2e') {
  const { page, errs } = await open('?story=base&movie=1&profile=LOW', { settle: 4000 });
  report.pageErrors = errs;
  const t0 = Date.now();
  const beats = [];
  let last = null, rescues = 0;
  const CAP = Number(process.env.VOX_E2E_CAP ?? 900);
  while ((Date.now() - t0) / 1000 < CAP) {
    const s = await page.evaluate(READ).catch(() => null);
    if (s) {
      if (s.beat !== last) {
        beats.push({ beat: s.beat, atSeconds: Number(((Date.now() - t0) / 1000).toFixed(1)),
          objectiveId: s.objectiveId, nudges: s.autopilot?.teleportNudgesTotal ?? null });
        flush();
        console.log(`  [e2e] ${s.beat} @ ${beats[beats.length - 1].atSeconds}s`);
        last = s.beat;
      }
      report.beats = beats;
      report.lastAutopilot = s.autopilot ?? null;
      if (s.beat === 'done' && (s.av?.history ?? []).includes('anc.ch10.threshold-handback')) {
        report.completed = true;
        report.durationSeconds = Number(((Date.now() - t0) / 1000).toFixed(1));
        break;
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  const RESCUES = () => ({ rescues: window.__storyTimeoutRescues ?? null,
    autopilot: window.__autopilot ? { nudges: window.__autopilot.teleportNudgesTotal,
      forced: window.__autopilot.forcedAdvances ?? null } : null });
  report.rescueProbe = await page.evaluate(RESCUES).catch(() => null);
  report.timeoutRescues = rescues;
  report.legCount = beats.length;
  flush();
  console.log(`[e2e] completed=${report.completed} duration=${report.durationSeconds}s legs=${beats.length}`
    + ` nudges=${report.lastAutopilot?.teleportNudgesTotal}`);
  await page.close();
}


// ====================================================================== gaze
// D-A3 (a) MECHANISM: the bias runs on BOTH ch10-cold walks, gated by
// isAutopilotDriving(), suppressing only non-goal-critical look via each act's
// commit distance. Lane is asserted from location.href before anything is
// measured. Walk A (to the habitat core) and walk B (to the fabricator/Kestrel)
// are separated by the ch10FaultRead milestone, which is exactly the branch the
// two tickSt0GazeBias call sites sit on (autopilot.ts:2181 / :2195).
if (MODE === 'gaze') {
  const URL_INTENDED = '?story=ch10-cold&movie=1&profile=LOW';
  const { page, errs } = await open(URL_INTENDED, { settle: 3000 });
  report.pageErrors = errs;
  report.urlIntended = URL_INTENDED;
  const lane = await page.evaluate(() => ({
    href: location.href,
    movieParam: new URLSearchParams(location.search).get('movie'),
    storyParam: new URLSearchParams(location.search).get('story'),
    profileParam: new URLSearchParams(location.search).get('profile')
  }));
  report.laneAssertion = { ...lane, lane: lane.movieParam === '1' ? 'movie' : 'manual' };
  if (lane.movieParam !== '1') {
    report.laneAssertionFailed = true;
    console.log('[gaze] ABORT: page is not in the movie lane:', lane.href);
  } else {
    const SAMPLE = async () => {
      const w = window; const spec = w.__voxSpec ?? {};
      const out = { t: Math.round(performance.now()), beat: w.__storyBeat ?? null,
        href: location.href, gaze: w.__st0Gaze ? { ...w.__st0Gaze } : null,
        autopilotTicking: !!w.__autopilot };
      try {
        const st = await import(/* @vite-ignore */ spec.storyState);
        const pr = await import(/* @vite-ignore */ spec.progression);
        out.faultRead = pr.hasMilestone(st.STORY_MILESTONES.ch10FaultRead);
        out.fabricationRefused = pr.hasMilestone(st.STORY_MILESTONES.ch10FabricationRefused);
      } catch { /* ignore */ }
      return out;
    };
    const rows = [];
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < 90) {
      const r = await page.evaluate(SAMPLE).catch(() => null);
      if (r) rows.push(r);
      if (r && r.beat && r.beat !== 'ch10-cold' && rows.some(x => x.beat === 'ch10-cold')) break;
      await new Promise(r2 => setTimeout(r2, 120));
    }
    // Bucket the counter DELTAS by walk. Counters are cumulative, so the delta
    // between consecutive samples is attributed to the walk that was live.
    const walks = { A_toCore: null, B_toFabricator: null };
    const mk = () => ({ samples: 0, frames: 0, framesDriving: 0, framesMovie: 0,
      framesGoalCritical: 0, framesAllConjunctsTrue: 0, framesAvailable: 0,
      framesEngaged: 0, blockedBy: {} });
    walks.A_toCore = mk(); walks.B_toFabricator = mk();
    let prev = null;
    for (const r of rows) {
      if (!r.gaze) continue;
      const bucket = r.faultRead ? walks.B_toFabricator : walks.A_toCore;
      bucket.samples++;
      if (r.gaze.blockedBy) bucket.blockedBy[r.gaze.blockedBy] = (bucket.blockedBy[r.gaze.blockedBy] ?? 0) + 1;
      if (prev && prev.gaze) {
        for (const k of ['frames', 'framesDriving', 'framesMovie', 'framesGoalCritical',
          'framesAllConjunctsTrue', 'framesAvailable', 'framesEngaged']) {
          const d = (r.gaze[k] ?? 0) - (prev.gaze[k] ?? 0);
          if (d > 0) bucket[k] += d;
        }
      }
      prev = r;
    }
    const last = [...rows].reverse().find(r => r.gaze)?.gaze ?? null;
    report.walks = walks;
    report.finalCounters = last;
    report.samples = rows.length;
    report.samplesWithGazeDiag = rows.filter(r => r.gaze).length;
    report.beatsSeen = [...new Set(rows.map(r => r.beat))];
    report.ranOnBothWalks = walks.A_toCore.frames > 0 && walks.B_toFabricator.frames > 0;
    report.gatedByDriving = last ? last.frames === last.framesDriving : null;
    report.suppressionRatio = last && last.frames
      ? Number((last.framesGoalCritical / last.frames).toFixed(4)) : null;
    report.priorSuppression = { framesGoalCritical: 346, frames: 419, note: 'pre-fix baseline' };
    report.trace = rows;
    flush();
    console.log(`[gaze] lane=${report.laneAssertion.lane} walkA.frames=${walks.A_toCore.frames}`
      + ` walkB.frames=${walks.B_toFabricator.frames}`
      + ` suppressed=${last?.framesGoalCritical}/${last?.frames}`
      + ` driving=${last?.framesDriving}`);
  }
  await page.close();
}

// ================================================================ nightdwell
// D-A3 (c) VISIBILITY: a dedicated night-dwell LOW capture. The camera stands
// at the hearth, steered onto the CLAIMED BEARING (derived from ST-0's own
// azimuth sweep, whose centre IS the true bearing by construction) and left
// there; ST-0 rises into the frustum under its own motion. 8 frames at 4s.
if (MODE === 'nightdwell' || MODE === 'st0still') {
  const HIGH_STILL = MODE === 'st0still';
  const dir = path.join(CAP_DIR, 'strip-st0-nightdwell');
  if (!HIGH_STILL) {
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) fs.unlinkSync(path.join(dir, f));
  }
  const ST0_URL = process.env.VOX_ST0_URL ?? '?story=ch10-cold&profile=LOW';
  const { page, errs } = await open(ST0_URL, { settle: 14000 });
  report.urlIntended = ST0_URL;
  report.pageErrors = errs;
  report.laneAssertion = await page.evaluate(() => ({ href: location.href,
    movieParam: new URLSearchParams(location.search).get('movie'),
    lane: new URLSearchParams(location.search).get('movie') === '1' ? 'movie' : 'manual' }));

  const HOLD_NIGHT = async (target) => {
    const spec = window.__voxSpec ?? {};
    const c = await import(/* @vite-ignore */ spec.worldClock);
    const n = await import(/* @vite-ignore */ spec.nightState);
    c.setDayPhaseOffset(c.getDayPhaseOffset() + (target - c.getCurrentDayPhase()));
    const phase = c.getCurrentDayPhase();
    const daylight = n.daylightFromDayPhase(phase);
    return { phase: Number(phase.toFixed(4)), daylight: Number(daylight.toFixed(4)),
      isNight: n.isDarkDaylight(daylight) };
  };
  // ST-0 sky sample in the LOCAL HORIZON frame at the camera.
  const ST0 = async () => {
    const w = window, THREE = w.__THREE;
    const spec = w.__voxSpec ?? {};
    const { scene, camera } = w.__voxPick();
    if (!scene || !camera || !THREE) return null;
    camera.updateMatrixWorld(true);
    let st0 = null, core = null;
    scene.traverse(o => {
      if (o.name === 'system-st0-station-light') st0 = o;
      if (!core && /habitat-core/i.test(o.name || '')) core = o;
    });
    const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
    const up = camPos.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    const eN = east.length() > 1e-6 ? east.normalize() : new THREE.Vector3(1, 0, 0);
    const nN = up.clone().cross(eN).normalize();
    const azOf = (d) => {
      const flat = d.clone().addScaledVector(up, -d.dot(up));
      return Math.atan2(flat.dot(eN), flat.dot(nN)) * 180 / Math.PI;
    };
    const altOf = (d) => 90 - Math.acos(Math.max(-1, Math.min(1, d.dot(up)))) * 180 / Math.PI;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const out = { promptActive: document.querySelectorAll('[data-interaction-prompt="primary"]').length > 0,
      prompts: [...document.querySelectorAll('[data-interaction-prompt="primary"]')].map(e => e.innerText.replace(/\s+/g, ' ').trim()),
      camAz: Number(azOf(fwd).toFixed(3)), camAlt: Number(altOf(fwd).toFixed(3)),
      fov: Number(camera.fov.toFixed(3)), camPos: [camPos.x, camPos.y, camPos.z].map(n => Number(n.toFixed(2))),
      coreDistance: null, st0: null };
    if (core) { const cp = new THREE.Vector3(); core.getWorldPosition(cp);
      out.coreName = core.name; out.coreDistance = Number(cp.distanceTo(camPos).toFixed(2)); }
    // Authoritative handle: the habitat system's own core position, which is
    // exactly what autopilot walks to. Scene-name matching is only a fallback.
    try {
      const h = await import(/* @vite-ignore */ spec.habitat);
      const t = await import(/* @vite-ignore */ spec.tidegarden);
      const st = h.getHabitatWorldState(t.TIDEGARDEN_WORLD_ID);
      // The core position is in GAME world space, which is NOT the render frame
      // (the renderer runs origin-shifted). Compare it against the same
      // getPlayerWorldPosition() the autopilot's own walk uses.
      const pf = await import(/* @vite-ignore */ spec.playerFrame);
      const pp = pf.getPlayerWorldPosition();
      out.playerWorld = [pp.x, pp.y, pp.z].map(n => Number(n.toFixed(2)));
      if (st?.core?.position) {
        const cp = new THREE.Vector3(...st.core.position);
        out.habitatCoreWorld = st.core.position.map(n => Number(n.toFixed(2)));
        out.habitatCoreDistanceEuclid = Number(cp.distanceTo(pp).toFixed(2));
        out.habitatCoreDistanceFromRenderCamera = Number(cp.distanceTo(camPos).toFixed(2));
        // The autopilot's own surfaceGaitDistance (autopilot.ts): tangential
        // range, plus any un-climbed rise, PLUS any drop the walker cannot step
        // down. This is the walker's distance to the handle and the convention
        // the contract's <=25 term inherits.
        //
        // The rise-only form this replaces is what let an owner-reported defect
        // through: it discounted downward offset entirely, so a habitat core
        // buried 45.8 units inside the planet reported 6.8 and cleared the
        // staging ceiling. The euclidean reading beside it is the cross-check —
        // a large gap between the two is the burial signature, and the report
        // now carries both plus the vertical offset that separates them.
        const pu = pf.getPlayerUp();
        const toGoal = cp.clone().sub(pp);
        const vertical = toGoal.dot(pu);
        toGoal.addScaledVector(pu, -vertical);
        const tangential = toGoal.length();
        out.habitatCoreDistance = Number((
          tangential + Math.max(0, vertical - 1) + Math.max(0, -vertical - 3.4)
        ).toFixed(2));
        out.habitatCoreRiseOnlyDistance = Number((
          tangential + Math.max(0, vertical - 1)
        ).toFixed(2));
        out.habitatCoreTangentialDistance = Number(tangential.toFixed(2));
        out.habitatCoreVerticalOffset = Number(vertical.toFixed(2));
      }
    } catch (e) { out.habitatError = String(e).slice(0, 120); }
    if (st0) {
      const wp = new THREE.Vector3(); st0.getWorldPosition(wp);
      const d = wp.clone().sub(camPos).normalize();
      const ndc = wp.clone().project(camera);
      out.st0 = { visible: st0.visible, opacity: Number((st0.material?.opacity ?? 0).toFixed(4)),
        az: Number(azOf(d).toFixed(3)), alt: Number(altOf(d).toFixed(3)),
        ndc: [Number(ndc.x.toFixed(4)), Number(ndc.y.toFixed(4))],
        inFrustum: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
        offAxisDeg: Number((Math.acos(Math.max(-1, Math.min(1, d.dot(fwd)))) * 180 / Math.PI).toFixed(3)),
        quadScale: Number((st0.scale?.x ?? 0).toFixed(5)),
        distance: Number(camPos.distanceTo(wp).toFixed(1)) };
    }
    return out;
  };
  // Steer the shipped cinematic look-pull to an azimuth/altitude, in world space.
  const AIM = async ({ az, alt }) => {
    const w = window, THREE = w.__THREE;
    const spec = w.__voxSpec ?? {};
    const cl = await import(/* @vite-ignore */ spec.cinematicLook);
    const { camera } = w.__voxPick();
    const camPos = new THREE.Vector3(); camera.getWorldPosition(camPos);
    const up = camPos.clone().normalize();
    const east = new THREE.Vector3(0, 1, 0).cross(up);
    const eN = east.length() > 1e-6 ? east.normalize() : new THREE.Vector3(1, 0, 0);
    const nN = up.clone().cross(eN).normalize();
    const a = az * Math.PI / 180, e = alt * Math.PI / 180;
    const d = nN.clone().multiplyScalar(Math.cos(a) * Math.cos(e))
      .addScaledVector(eN, Math.sin(a) * Math.cos(e))
      .addScaledVector(up, Math.sin(e)).normalize();
    cl.setCinematicGazeIntent(null);
    cl.setCinematicLookTarget(camPos.clone().addScaledVector(d, 20000));
    cl.setCinematicLookWeight(1);
    return true;
  };

  await page.evaluate(HOLD_NIGHT, 0.62).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  if (HIGH_STILL) {
    // ---- CLOSE THE 25-UNIT STAGING TERM ---------------------------------
  // Two prior attempts shot from the Kestrel. The camera walks to the habitat
  // core on real player input: aim at the core, hold W, stop inside 25 units.
  const CORE_AIM = async () => {
    const w = window, THREE = w.__THREE; const spec = w.__voxSpec ?? {};
    const cl = await import(/* @vite-ignore */ spec.cinematicLook);
    const h = await import(/* @vite-ignore */ spec.habitat);
    const t = await import(/* @vite-ignore */ spec.tidegarden);
    const st = h.getHabitatWorldState(t.TIDEGARDEN_WORLD_ID);
    if (!st?.core?.position) return false;
    cl.setCinematicGazeIntent(null);
    cl.setCinematicLookTarget(new THREE.Vector3(...st.core.position));
    cl.setCinematicLookWeight(1);
    return true;
  };
  // Movement is gated on pointer lock, which headless Chromium never grants.
  // The SHIPPED synthesis path (utils/mobileInput.ts) is the same one the
  // touch controls use: setTouchActive() opens the gate and pressKey()
  // dispatches the very KeyW the controllers already listen for.
  const WALK = async (down) => {
    const spec = window.__voxSpec ?? {};
    const mi = await import(/* @vite-ignore */ spec.mobileInput);
    if (down) { mi.setTouchActive(true); mi.pressKey('KeyW'); }
    else { mi.releaseAllKeys(); mi.setTouchActive(false); }
    return mi.isTouchActive();
  };
  const walk = [];
  await page.evaluate(CORE_AIM).catch(e => { report.coreAimError = String(e).slice(0, 160); });
  await new Promise(r => setTimeout(r, 1800));
  report.walkGateOpened = await page.evaluate(WALK, true).catch(e => String(e).slice(0, 160));
  const tw = Date.now();
  let coreD = null;
  while ((Date.now() - tw) / 1000 < 90) {
    await page.evaluate(CORE_AIM).catch(() => {});
    await page.evaluate(WALK, true).catch(() => {});
    const s = await page.evaluate(ST0).catch(() => null);
    coreD = s?.habitatCoreDistance ?? null;
    walk.push({ t: Number(((Date.now() - tw) / 1000).toFixed(2)), coreDistance: coreD,
      promptActive: s?.promptActive ?? null, prompts: s?.prompts ?? null,
      playerWorld: s?.playerWorld ?? null });
    if (coreD != null && coreD <= 12 && s && s.promptActive === false) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await page.evaluate(WALK, false).catch(() => {});
  await new Promise(r => setTimeout(r, 900));
  report.coreWalk = { frames: walk.length, finalCoreDistance: coreD, trace: walk };
  console.log(`[st0still] walked to core: ${coreD}u`);
  }

  // ---- PHASE TRACE: one full 90s ellipse, sampled at 4 Hz -----------------
  const trace = [];
  const tp0 = Date.now();
  let heldAt = Date.now();
  while ((Date.now() - tp0) / 1000 < 100) {
    if (Date.now() - heldAt > 5000) { await page.evaluate(HOLD_NIGHT, 0.62).catch(() => {}); heldAt = Date.now(); }
    const s = await page.evaluate(ST0).catch(() => null);
    if (s) trace.push({ t: Number(((Date.now() - tp0) / 1000).toFixed(2)), ...s });
    await new Promise(r => setTimeout(r, 250));
  }
  const withSt0 = trace.filter(r => r.st0);
  const azs = withSt0.map(r => r.st0.az), alts = withSt0.map(r => r.st0.alt);
  const bearingAz = azs.length ? (Math.min(...azs) + Math.max(...azs)) / 2 : null;
  const peakAlt = alts.length ? Math.max(...alts) : null;
  report.phaseTrace = { samples: trace.length, withSt0: withSt0.length,
    azMin: azs.length ? Number(Math.min(...azs).toFixed(2)) : null,
    azMax: azs.length ? Number(Math.max(...azs).toFixed(2)) : null,
    bearingAzDeg: bearingAz != null ? Number(bearingAz.toFixed(3)) : null,
    altMin: alts.length ? Number(Math.min(...alts).toFixed(2)) : null,
    peakAltDeg: peakAlt != null ? Number(peakAlt.toFixed(3)) : null,
    aboveHorizonSamples: withSt0.filter(r => r.st0.alt > 0).length,
    visibleSamples: withSt0.filter(r => r.st0.visible).length,
    coreDistance: trace.find(r => r.coreDistance != null)?.coreDistance ?? null,
    trace: withSt0.map(r => ({ t: r.t, az: r.st0.az, alt: r.st0.alt, vis: r.st0.visible })) };
  flush();
  console.log(`[${MODE}] bearingAz=${report.phaseTrace.bearingAzDeg} peakAlt=${report.phaseTrace.peakAltDeg}`
    + ` aboveHorizon=${report.phaseTrace.aboveHorizonSamples}/${withSt0.length}`);

  if (bearingAz == null) { report.aborted = 'no ST-0 samples'; }
  else if (!HIGH_STILL) {
    // ---- night dwell: aim at the claimed bearing, hold, 8 frames at 4s ----
    const aimAlt = Math.max(0, (peakAlt ?? 12) - 15);
    // closed-loop aim on the claimed bearing (the look-pull decays toward it)
    let aimErr = null;
    for (let i = 0; i < 60; i++) {
      await page.evaluate(AIM, { az: bearingAz, alt: aimAlt }).catch(e => { report.aimError = String(e).slice(0, 160); });
      await new Promise(r => setTimeout(r, 250));
      const s = await page.evaluate(ST0).catch(() => null);
      if (s) aimErr = ((s.camAz - bearingAz + 540) % 360) - 180;
      if (aimErr != null && Math.abs(aimErr) < 2) break;
    }
    report.aimConvergedDeg = aimErr != null ? Number(aimErr.toFixed(3)) : null;
    report.aimToleranceDeg = 20;
    // wait for the predicted rise, then shoot 8 frames at 4s
    const riseWait = Date.now();
    let rose = false;
    while ((Date.now() - riseWait) / 1000 < 95) {
      await page.evaluate(HOLD_NIGHT, 0.62).catch(() => {});
      const s = await page.evaluate(ST0).catch(() => null);
      if (s?.st0?.visible && s.st0.alt > 1) { rose = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    report.risePredictedFromTrace = true;
    report.roseBeforeCapture = rose;
    const frames = [];
    for (let i = 0; i < 8; i++) {
      await page.evaluate(HOLD_NIGHT, 0.62).catch(() => {});
      const s = await page.evaluate(ST0).catch(() => null);
      const file = `${String(i).padStart(2, '0')}_dwell_${(await page.evaluate(() => window.__storyBeat ?? 'null'))}.png`;
      await page.screenshot({ path: path.join(dir, file) });
      frames.push({ index: i, file: `evidence/capture/strip-st0-nightdwell/${file}`,
        tSeconds: i * 4, camAz: s?.camAz ?? null, camAlt: s?.camAlt ?? null, fov: s?.fov ?? null,
        bearingDeltaDeg: s ? Number((((s.camAz - bearingAz + 540) % 360) - 180).toFixed(2)) : null,
        coreDistance: s?.coreDistance ?? null, habitatCoreDistance: s?.habitatCoreDistance ?? null,
        st0: s?.st0 ?? null });
      flush();
      report.frames = frames;
      if (i < 7) await new Promise(r => setTimeout(r, 4000));
    }
    report.inFrustumFrames = frames.filter(f => f.st0?.inFrustum).length;
    report.visibleFrames = frames.filter(f => f.st0?.visible).length;
    report.inFrustumAndVisibleFrames = frames.filter(f => f.st0?.inFrustum && f.st0?.visible).length;
    report.acceptance = { requirement: '>=4 of 8 in frustum',
      pass: report.inFrustumFrames >= 4 };
    flush();
    console.log(`[nightdwell] inFrustum=${report.inFrustumFrames}/8 visible=${report.visibleFrames}/8`);
  } else {
    // ---- HIGH hero still: yaw to bearing +-2, pitch peak-15, FOV 75 -------
    const aimAlt = Math.max(0, (peakAlt ?? 16) - 15);
    report.aimTarget = { azDeg: Number(bearingAz.toFixed(3)), altDeg: Number(aimAlt.toFixed(3)),
      peakAltDeg: peakAlt };
    for (let i = 0; i < 40; i++) {
      await page.evaluate(AIM, { az: bearingAz, alt: aimAlt }).catch(e => { report.aimError = String(e).slice(0, 160); });
      await new Promise(r => setTimeout(r, 200));
      const s = await page.evaluate(ST0).catch(() => null);
      if (s && Math.abs(((s.camAz - bearingAz + 540) % 360) - 180) < 1) break;
    }
    report.appliedProfile = await page.evaluate(SET_PROFILE, 'HIGH').catch(e => String(e).slice(0, 90));
    // yaw LOCKED through the HIGH warm
    for (let i = 0; i < 30; i++) {
      await page.evaluate(AIM, { az: bearingAz, alt: aimAlt }).catch(() => {});
      await new Promise(r => setTimeout(r, 200));
    }
    // hold the aim through the HIGH warm, then wait for an arc frame >=10deg
    // TWO-PASS SHUTTER. The criterion binds three things at once: elevation
    // >=10deg (peak preferred), the dot on the upper-third line +-5% of frame
    // height, and yaw within +-2deg of the claimed bearing. At the prescribed
    // pitch (peak-15deg) the latitude peak does NOT land on the upper third,
    // because at the peak the dot is far off-axis horizontally and a
    // perspective projection is not a linear map of elevation. Pass one traces
    // the arc and finds the highest-elevation frame that also lands the dot in
    // the band; pass two fires the shutter when that frame recurs.
    const frameYOf = (ndc) => ((1 - ndc[1]) / 2) * 100;
    const inBand = (ndc) => Math.abs(frameYOf(ndc) - (100 / 3)) <= 5;
    const arc = [];
    const tScan = Date.now();
    while ((Date.now() - tScan) / 1000 < 100) {
      await page.evaluate(HOLD_NIGHT, 0.62).catch(() => {});
      await page.evaluate(AIM, { az: bearingAz, alt: aimAlt }).catch(() => {});
      const s = await page.evaluate(ST0).catch(() => null);
      if (s?.st0) arc.push({ t: Number(((Date.now() - tScan) / 1000).toFixed(2)),
        alt: s.st0.alt, ndc: s.st0.ndc, frameY: Number(frameYOf(s.st0.ndc).toFixed(2)),
        vis: s.st0.visible, inFrustum: s.st0.inFrustum,
        yawErr: Number((((s.camAz - bearingAz + 540) % 360) - 180).toFixed(3)) });
      await new Promise(r => setTimeout(r, 250));
    }
    const cands = arc.filter(r => r.vis && r.inFrustum && r.alt >= 10
      && Math.abs(r.yawErr) <= 2 && inBand(r.ndc));
    const best = cands.length ? cands.reduce((a, b) => (b.alt > a.alt ? b : a)) : null;
    report.shutterPlan = { arcSamples: arc.length, candidates: cands.length,
      best: best ?? null, altFloorDeg: 10, frameYBand: [100 / 3 - 5, 100 / 3 + 5] };
    // ---- pass two: fire when the planned frame recurs --------------------
    const t1 = Date.now();
    let shot = null;
    const wantAlt = best ? best.alt : Math.max(10, (peakAlt ?? 16) - 4);
    while ((Date.now() - t1) / 1000 < 220) {
      await page.evaluate(HOLD_NIGHT, 0.62).catch(() => {});
      await page.evaluate(AIM, { az: bearingAz, alt: aimAlt }).catch(() => {});
      const s = await page.evaluate(ST0).catch(() => null);
      if (s?.st0 && s.st0.visible && s.st0.inFrustum && s.st0.alt >= 10
        && Math.abs(((s.camAz - bearingAz + 540) % 360) - 180) <= 2
        && inBand(s.st0.ndc) && s.st0.alt >= wantAlt - 1.0) { shot = s; break; }
      if (s?.st0 && s.st0.visible && s.st0.inFrustum && s.st0.alt >= 10
        && Math.abs(((s.camAz - bearingAz + 540) % 360) - 180) <= 2
        && inBand(s.st0.ndc)) shot = s;   // keep the best legal frame seen
      await new Promise(r => setTimeout(r, 250));
    }
    report.arcTrace = arc;
    report.shutterState = shot;
    if (shot) {
      await page.screenshot({ path: path.join(CAP_DIR, 'still-st0-sighting.png') });
      report.uiRects = await page.evaluate(UI_RECTS).catch(() => null);
      report.uiHidden = await page.evaluate(HIDE_UI).catch(() => null);
      await page.screenshot({ path: path.join(CAP_DIR, 'still-st0-sighting-scene.png') });
      report.sceneFile = 'evidence/capture/still-st0-sighting-scene.png';
      await page.evaluate(SHOW_UI).catch(() => {});
      const at = await page.evaluate(READ).catch(() => ({}));
      const comp = await page.evaluate(COMPOSE).catch(() => null);
      report.still = { id: 'still-st0-sighting', file: 'evidence/capture/still-st0-sighting.png',
        qualityProfile: at.qualityProfile ?? null,
        renderCameraFov: comp?.renderCamera?.fov ?? null,
        camAzDeg: shot.camAz, camAltDeg: shot.camAlt,
        bearingAzDeg: Number(bearingAz.toFixed(3)),
        yawErrorDeg: Number((((shot.camAz - bearingAz + 540) % 360) - 180).toFixed(3)),
        st0AltDeg: shot.st0.alt, st0Ndc: shot.st0.ndc,
        st0FrameYPercent: Number((((1 - shot.st0.ndc[1]) / 2) * 100).toFixed(2)),
        coreDistance: shot.coreDistance, habitatCoreDistance: shot.habitatCoreDistance ?? null,
        habitatCoreWorld: shot.habitatCoreWorld ?? null, dayPhase: at.dayPhase ?? null,
        daylight: at.daylight ?? null, isNight: at.isNight ?? null,
        objectiveId: at.objectiveId ?? null, caption: at.caption ?? null,
        hudText: at.hudText ?? null,
        interactionPromptActive: at.interactionPromptActive ?? null,
        interactionPrompts: at.interactionPrompts ?? null,
        st0DeviceProjectedPixels: null, state: at };
    } else report.shutterMissed = true;
    flush();
    console.log(`[st0still] shot=${!!shot} alt=${shot?.st0?.alt} yawErr=${report.still?.yawErrorDeg}`);
  }
  await page.close();
}

// =================================================================== translegs
// Re-verify what the boost suppression touched: one ch10-transit leg, FOV
// 70.0-70.0, boost 0, shell scale 1.0, zero frames above 73.72, and the
// cockpit shell still reaching the frame border (no sky past the shell, S-1).
if (MODE === 'transit') {
  const URL_INTENDED = '?story=ch10-transit&movie=1&profile=LOW';
  const { page, errs } = await open(URL_INTENDED, { settle: 6000 });
  report.pageErrors = errs;
  report.urlIntended = URL_INTENDED;
  report.laneAssertion = await page.evaluate(() => ({ href: location.href,
    movieParam: new URLSearchParams(location.search).get('movie'),
    lane: new URLSearchParams(location.search).get('movie') === '1' ? 'movie' : 'manual' }));
  const rows = [];
  const t0 = Date.now();
  let borderChecks = [];
  while ((Date.now() - t0) / 1000 < 240) {
    const r = await page.evaluate(READ).catch(() => null);
    const c = await page.evaluate(COMPOSE).catch(() => null);
    if (r) rows.push({ t: Number(((Date.now() - t0) / 1000).toFixed(2)), beat: r.beat,
      href: r.href, lane: r.lane,
      feedbackFov: r.flightFeedback?.fov ?? null, boost: r.flightFeedback?.boost ?? null,
      speed: r.flightFeedback?.speed ?? null,
      renderCameraFov: c?.renderCamera?.fov ?? null,
      shellWorldScale: c?.cockpit?.shellWorldScale?.[0] ?? null,
      rootWorldScale: c?.cockpit?.rootWorldScale?.[0] ?? null,
      history: r.av?.history ?? [], avFov: r.av?.fov ?? null,
      stationDistance: r.contacts?.stations?.[0]?.distance ?? null });
    if (rows.length % 12 === 0) {
      const m = await page.evaluate(MASKS).catch(() => null);
      if (m?.cockpit) borderChecks.push({ t: rows[rows.length - 1].t,
        borderCoveragePercent: m.cockpit.borderCoveragePercent,
        aperturePercentOfFrameWidth: m.cockpit.aperturePercentOfFrameWidth });
    }
    const lastRow = rows[rows.length - 1];
    if (lastRow && (lastRow.history ?? []).includes('anc.ch10.threshold-handback')) break;
    await new Promise(r2 => setTimeout(r2, 400));
  }
  const inTransit = rows.filter(r => r.beat === 'ch10-transit');
  const num = (a) => a.filter(n => typeof n === 'number');
  const fovs = num(inTransit.map(r => r.feedbackFov));
  const cfovs = num(inTransit.map(r => r.renderCameraFov));
  const boosts = num(inTransit.map(r => r.boost));
  const shells = num(inTransit.map(r => r.shellWorldScale));
  report.transit = { samples: inTransit.length,
    feedbackFovMin: fovs.length ? Math.min(...fovs) : null,
    feedbackFovMax: fovs.length ? Math.max(...fovs) : null,
    renderCameraFovMin: cfovs.length ? Math.min(...cfovs) : null,
    renderCameraFovMax: cfovs.length ? Math.max(...cfovs) : null,
    boostMax: boosts.length ? Math.max(...boosts) : null,
    shellWorldScaleMin: shells.length ? Number(Math.min(...shells).toFixed(5)) : null,
    shellWorldScaleMax: shells.length ? Number(Math.max(...shells).toFixed(5)) : null,
    framesAboveFov73_72: fovs.filter(f => f > 73.72).length,
    framesAboveFov73_72_renderCamera: cfovs.filter(f => f > 73.72).length,
    borderChecks,
    minBorderCoveragePercent: borderChecks.length
      ? Math.min(...borderChecks.map(b => b.borderCoveragePercent)) : null,
    reachedHandback: rows.some(r => (r.history ?? []).includes('anc.ch10.threshold-handback')) };
  report.trace = rows;
  flush();
  console.log(`[transit] fov=${report.transit.feedbackFovMin}-${report.transit.feedbackFovMax}`
    + ` camFov=${report.transit.renderCameraFovMin}-${report.transit.renderCameraFovMax}`
    + ` boostMax=${report.transit.boostMax} shell=${report.transit.shellWorldScaleMax}`
    + ` above73.72=${report.transit.framesAboveFov73_72}`
    + ` border=${report.transit.minBorderCoveragePercent}%`);
  await page.close();
}

await browser.close();
flush();
console.log('wrote', OUT);
