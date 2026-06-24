# Paravoxia — The Underwater Experience

**The single source of truth for the underwater system.** Read this to understand
what we're building, why, where every piece hooks into the existing code, and the
order to build it. Last updated 2026-06-24.

> **STATUS: BUILT (M0–M4), 2026-06-24.** Swim physics, audio muffle + splash, fog
> override, the depth-based underwater post pass (extinction + haze + godrays +
> wobble + vignette + crossing wipe), the Snell-window dome, marine-snow/bubble
> particles, oxygen/breath + HUD, camera sway, mobile DIVE, and the quality knobs
> are all implemented and pass `npm run verify` (typecheck + 322 tests + build).
> **Deferred** — full backlog with pickup notes in **§15**: in-scene **caustics**,
> per-planet **palette**, headed **visual capture**, underwater ambient audio, and
> smaller polish. Design direction is **locked** (see §0).

Companion design DNA: the per-planet **biome cohesion** system (`waterProfile.ts`,
`biomeProfile.ts`) — the underwater look reads its colors from there, so each
planet's sea is distinct underwater too. The **material-quality-bar** rule applies:
every new surface must look deliberately authored under all conditions.

---

## 0. Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Breath / drowning mechanic | **YES** — oxygen vital, generous ~60s, **non-lethal HP-bleed** at empty (scramble-up grace). |
| 2 | Swim model | **Full 6-DOF free-swim** (swim where you look), blended by `submergence` so wading in is smooth. |
| 3 | Visual intensity | **Vibrant**, per-planet-tinted (decoupled extinction, à la Subnautica); lean murkier on arid/alien biomes. |

**The thesis:** the "phase change" feeling is carried by the **threshold crossing**
and the **movement-model change**, NOT by a blue tint. A filter over normal walking
reads as a filter; a half-second audio muffle-snap + weightless, draggy body + the
world fogging to blue-green reads as *a different medium*. We build **feel-first,
look-second** — but hit the IQ bar where it counts.

---

## 1. Current state — what exists, and the 4 gaps

| Subsystem | Today | File(s) |
|---|---|---|
| **Water render** | Voxel *faces* (top quads + coastal walls), one InstancedMesh, high-quality Gerstner surface shader (analytic normal, Fresnel, SSS, sun/moon glint, per-planet colors). `side:FrontSide`, `depthWrite:false`, unlit-emissive. | `components/WaterBlocks.tsx`, `utils/waterBlocksMaterial.ts`, `utils/waterProfile.ts` |
| **Water classification** | `gen.isWaterVoxel(x,y,z)` — cached O(1) flood-fill Set, **static** (not updated by digging). Sea level = generator percentile, compared on the **dominant cube axis** (not a sphere). | `utils/proceduralWorldGenerator.ts:344,616`, `utils/worldGenCache.ts:141` |
| **Player** | Rapier dynamic body, `gravityScale=0`; all motion hand-rolled in `useBeforePhysicsStep`. Gravity integrated along `up`, then `composeVelocity()` **forces movement into the surface tangent plane**. Jetpack vertical thrust + 3-axis ladder override already exist (reusable). | `components/EfficientPlayer.tsx:732-895`, `utils/surfaceControls.ts:226,378` |
| **Post** | `EffectComposer` mounted **only on ULTRA/HIGH** (`postProcess`). Custom passes subclass `Effect` w/ `EffectAttribute.DEPTH`; uniforms driven via module-handle (`getColorGrade()`). | `components/effects/PostFX.tsx`, `components/effects/ColorGradeEffect.ts:66,81`, `components/effects/OutlineEffect.ts:45` |
| **Fog** | Single `FogExp2` owned by SkyController; `applySpaceMode()` is the precedent for slamming fog/light into a "mode." | `components/SkyController.tsx:274-282,150-170` |
| **Audio** | Two WebAudio graphs (`sfxEngine`, `musicEngine`), each a master gain → destination; `AudioDirector` rAF tick. | `audio/sfxEngine.ts:108`, `audio/musicEngine.ts:293`, `components/audio/AudioDirector.tsx:63` |
| **Survival** | health / hunger / thirst / warmth / stamina. **No oxygen.** | `game/systems/survivalVitals.ts:13-22` |

### The 4 gaps that define the work
1. **No submersion signal exists anywhere** — nothing knows the eye is underwater.
2. **Water is `FrontSide` + writes no depth** → invisible/unreliable from below; the
   "looking up" view is broken. *(Solved by the Snell dome, §6.)*
3. **Movement is tangent-locked** → you physically cannot swim in 3D. It's a
   structural limit of `composeVelocity`, not a parameter. *(New swim path, §4.)*
4. **The screen pass is ULTRA/HIGH-only** → an underwater *state* must reach every
   tier, so it can't live solely in the composer. *(Hybrid render strategy, §6.)*

---

## 2. Architecture — the `submergence` spine (build this FIRST)

One signal, one source of truth. **Everything reads it; nothing recomputes it.** A
single `0..1` float `submergence` (+ `depthBelow` in metres), computed **once per
physics step**, asymmetrically smoothed (fast-in ~0.18s, fast-out ~0.12s) so crossing
the waterline is a discrete *moment*. One source = no waterline desync between
effects, which is the #1 thing that breaks the illusion.

```
                          ┌───────────────────────────────┐
  EfficientPlayer         │  state/playerSubmersion.ts     │
  useBeforePhysicsStep ──▶│  setPlayerSubmerged(amt,depth) │
  (eye voxel test)        │  getPlayerSubmerged()          │
                          └───────────────────────────────┘
                                    │  read by ▼
   ┌──────────┬──────────────┬──────────────┬───────────┬────────────┬──────────┐
   ▼          ▼              ▼              ▼           ▼            ▼          ▼
 swim       audio        fog override   post pass   oxygen tick  particles   camera
 physics    muffle       (SkyController) (PostFX)   (vitals)     visibility  sway
```

**New module** `state/playerSubmersion.ts` — clone of `state/playerFrame.ts`.

**Detection** in `EfficientPlayer.tsx`'s `useBeforePhysicsStep`, right after
`activeUp` is known (~line 755):

```
eye   = bodyPos + activeUp * PLAYER_EYE_HEIGHT(1.35)     // eye, NOT capsule center
cell  = round(eye / VOXEL_SCALE(2)) per-axis
wet   = gen.isWaterVoxel(cell.x, cell.y, cell.z)         // same singleton WaterBlocks uses
depth = (getSeaLevelRadius() - dominantAxisRadius(cell)) * VOXEL_SCALE
submergence ← asymmetric-lerp toward (wet ? 1 : 0)
setPlayerSubmerged(submergence, depth)
```

**Why `isWaterVoxel`, not `eye.length() < seaRadius`:** the planet is a **cube**, so a
sphere-radius test misclassifies near edges/corners and ignores connectivity (dry
sub-sea-level caves). The per-voxel test is cube-axis-correct *and* matches exactly
what renders as water → physics and visuals agree by construction.

**Wiring:** `EfficientPlayer` doesn't currently know `terrainSeed`. Pass it down from
`EfficientScene.tsx:154` so it can grab `getWorldGen(planetSize, terrainSeed).generator`
once (memo the closure, exactly like `WaterBlocks.tsx:90`).

**v1 limitation (accept & document):** `isWaterVoxel` is static-gen only, so a
player-dug channel won't "fill." Fine for swimming natural oceans; flag, don't solve.

---

## 3. Movement — buoyancy + 6-DOF swimming `[M1]`

Branch the velocity assembly in `useBeforePhysicsStep` on `submergence`. **Every
parameter lerps by `submergence`** so wading is smooth — no hard switch at the
waterline. Land walking is **byte-for-byte identical** when `submergence==0`.

| Lever | Walk (today) | Swim (submerged) | How |
|---|---|---|---|
| Gravity | `g = up·-9.81` | `g·(1 − buoyancy·subm)`, buoyancy≈1.1 → slight net **up** (slow rise) | scale before `integrateLocalGravity` (`:818`) |
| Drag | `linearDamping 0.5` | heavy: lerp → ~3–6 | `body.setLinearDamping(lerp(...))` per step |
| Move dir | tangent-locked (`composeVelocity`) | **full 3D toward camera look** (pitch incl.) | `camera.getWorldDirection()` + new `composeSwimVelocity` |
| Speed | 5 m/s | ~3.5 m/s, inertial | reduced speed + accel ramp |
| Up / down | jump only | **jump = swim-up, new "dive" key = swim-down** (fuel-free) | reuse jetpack additive-up (`:849-866`); gate `else if (!submerged)` so they're mutually exclusive |
| Terminal rise | — | cap ~1.5 m/s (gentle, not a pop) | clamp up-component |

**Do NOT touch** `body.setRotation(quaternionForUp(activeUp))` at `:759` — the capsule
stays upright (it's overwritten every step anyway). All underwater *tilt* lives in the
camera layer (§8). Bypass the `grounded` inward-speed clamp while submerged so
buoyancy doesn't fight a seabed "grounded" reading.

Structurally, the swim controller is the existing **ladder branch (`:868-873`)
generalized to all 3 axes** + the jetpack thrust pattern, with drag and reduced
gravity. The substrate is already here.

**Mobile** (`utils/mobileInput.ts:34`, `components/mobile/TouchControls.tsx:164`): add
`KEY_CODES.down` + a **DIVE** button in the fps cluster grid; JMP already maps to Space
= swim-up.

---

## 4. The threshold moment `[M1]` — cheap, all tiers

Fire on `submergence` crossing 0.5 (edge-detect off the spine; never author a
separate timer):

- **Audio snap** — insert one `BiquadFilterNode` (lowpass) on each engine's master
  bus: `sfx: outputGain→filter→destination` (`sfxEngine.ts:108`);
  `music: musicGain→filter→visibilityGain→destination` (`musicEngine.ts:293`).
  Init at **18 kHz** (transparent → dry sound byte-identical). Entry ramps cutoff →
  **~600 Hz over 80 ms** (the "clunk"); exit releases over **~150 ms** (the "gasp").
  Mirror the existing `setVisibilityDucked` / `rampParam` pattern
  (`musicEngine.ts:124,311`; `sfxEngine.ts:218`). Keep the muffle on a **separate
  node** from user-volume so it composes, not fights.
- **Splash SFX** — new `splashEnter` / `splashExit` events: `playNoise` lowpass-swept
  + a short bandpass bubble burst (a 6-line case in the existing switch). Drive from
  `AudioDirector`'s tick reading `getPlayerSubmerged()`, edge-triggered via a `useRef`
  (like `warpActiveRef`, `AudioDirector.tsx:35`).
- **Screen wipe** (composer tiers) — a `uWipe` uniform on the underwater pass,
  animated 1→0 over ~0.35s: a refraction-distorted water-line sweeping the screen on
  entry; gravity-streaked lens droplets on exit. On no-composer tiers, fog + audio
  snap alone still sell the crossing.

---

## 5. Rendering — the IQ-grade underwater look `[M2]`

**Tiering strategy (avoids the two-composer trap):** the depth fullscreen pass
injects into the **existing** PostFX composer on ULTRA/HIGH (right before
`<ToneMapping>`, `PostFX.tsx:152`); **never spin up a second composer.** Everyone else
gets the in-scene + fog path, which is genuinely good. Keep the pass **mounted** and
drive `uSubmergence→0` above water (avoid render-target recreation hitches).

> **Constraint kept front-of-mind:** the water surface writes no depth, so below it the
> depth buffer holds the *seabed*, never the surface. That's exactly right for
> extinction/fog (eye→seabed distance), but means the surface plane must be
> **reconstructed analytically** (Snell dome), never sampled.

| Technique | Placement | Reaches | Cost | Priority |
|---|---|---|---|---|
| **Beer-Lambert extinction** (`exp(-σ·dist)`, red dies first) | fullscreen pass (depth) | ULTRA/HIGH | cheap | **core** |
| **Volumetric haze** (inscatter, sun-directional, domain-warped) | pass + **FogExp2 override** fallback | **all** | cheap | **core** |
| **Caustics** (Hoskins `MdlXz8`, triplanar from up, sun/up-masked, depth-faded) | **in-scene** seabed material | **all** | moderate | **high** |
| **Snell's window + TIR mirror** (camera-attached underside dome) | **in-scene** geometry | **all** | moderate | **high** |
| **God rays** (radial blur from sun screen-pos, GPU Gems 3) | fullscreen pass | ULTRA/HIGH | moderate | high |
| **Refraction wobble** (sin+fbm UV displacement, edge-faded) | fullscreen pass | ULTRA/HIGH | cheap | polish |

### 5.1 Core look — extinction + haze (one `mainImage`) ≈ 70% of "reads as underwater"
```glsl
float dist = -getViewZ(depth);                       // eye→seabed (water writes no depth = correct)
vec3  T    = exp(-uSigma * dist);                    // σ≈vec3(0.45,0.15,0.10)/m → red gone @~1.5m
vec3  col  = inputColor.rgb * T + uDeepTint * (1.0 - T);
float fog  = 1.0 - exp(-dist * uFogDensity);
vec3  haze = mix(uHaze, uHazeSun, pow(max(dot(rayDir, uSunDir), 0.0), 6.0));  // brighter toward sun
col = mix(col, haze, fog);
outputColor.rgb = mix(inputColor.rgb, col, submergence);
```
**Subnautica insight to steal:** *decouple* the sun-attenuation-with-depth from the
eye-attenuation-toward-camera (don't use one global σ for both). That's the difference
between "murky blue cast" and "vibrant photographed reef." Per decision #3, lean
vibrant; pull σ/tint from `waterProfile.ts` so each planet differs underwater.

### 5.2 Caustics — in-scene so even LOW gets them
Project the Hoskins `MdlXz8` field via a triplanar basis from the smooth-gravity `up`
(so the net lies flat over any cube face), then mask + fade:
```glsl
vec3 up = normalize(uUp);
vec3 t1 = normalize(cross(up, vec3(0,0,1) + 0.001));
vec3 t2 = cross(up, t1);
vec2 cuv = vec2(dot(worldPos, t1), dot(worldPos, t2)) * uCausticScale;
float caus = caustic(cuv, uTime * uSpeed);           // 5-iter sin/cos turbulence loop
caus *= max(dot(N, up), 0.0) * max(dot(N, uSunDir), 0.0);   // lit, up-facing only
caus *= exp(-depthBelow * uCausticFade);             // dims with depth (comes from the surface)
// chromatic edge: sample at offset times for R/G/B; fwidth-AA to kill distant shimmer
```

### 5.3 Snell's window + TIR mirror — solves gap #2
Since the water faces are invisible from below, render a **camera-attached `BackSide`
dome** (in-scene → all tiers). Split view-vs-up angle at the **48.6° critical angle**:
inside the cone → bright refracted sky/sun disc; outside → TIR mirror tint; chromatic
rim.
```glsl
float cosT = dot(vDir, uUp);
float sinT = sqrt(max(0.0, 1.0 - cosT*cosT));
float window = 1.0 - smoothstep(0.96, 1.0, sinT * 1.333);   // soft cone edge (n=1.333)
vec3 surf = mix(uDeepTint, skyTowardSun(vDir, uSunDir), window);
surf += sunHotspot * pow(max(dot(vDir, uSunDir), 0.0), 64.0);
```
*(A flipped `DoubleSide` water would fight the Gerstner displacement + z-order; the
dome decouples it cleanly.)*

### 5.4 IQ niceties that hit the quality bar
- **`fwidth` analytic AA** on the caustic net — it shimmers viciously at distance
  otherwise (IQ *filterable procedurals*).
- **`fbm(p + fbm(p))` domain warp** for organic "thicker here, clearer there" haze
  density (IQ *domain warping*).
- **`smin`** to blend the godray column into the haze without a seam (IQ *smooth min*).
- **Tone-map BEFORE bloom** so the Snell sun-disc reads as a glowing disc with a hot
  rim, not a clipped white blob (order: tone-map → bloom → output).

### 5.5 Cheap-tier path (MEDIUM / LOW / POTATO) — no composer, still believable
`applyWaterMode()` in `SkyController`, mirroring `applySpaceMode()` (`:150-170`): lerp
`FogExp2.color` → deep teal and raise `density` by `submergence`, called from **both**
the boundary effect (`~:294`) **and** the per-frame update (`~:318`) so it lands even
when `animatedShaders=false`. Plus in-scene caustics (§5.2) + a simplified Snell dome.

---

## 6. Survival — oxygen / breath `[M3]`

Add `oxygen` to `survivalVitals.ts` (mirror the **stamina** pattern: silent per-step
updater the HUD polls + discrete events). Tick beside `tickVitals` in
`EfficientPlayer`'s `useFrame` (`:912`), fed the submerged bool.

- **Drain** while `submergence>0.5`; **~60s** of swim time (generous-but-tense).
- **Refill** ~3–4× faster on surfacing.
- **At 0: tick HP, do NOT insta-kill** (~8 HP/s) so the player can scramble up.
- **HUD** ring meter cloned from `hud/JetpackMeter.tsx` (existing rAF-polled meter +
  `getJetpackFuel`-style module export, `EfficientPlayer.tsx:133`); shown only
  underwater / when not full.
- **Below 25%:** heartbeat SFX (two low sines via `playTone`) + a vignette pulse
  (~1.1 Hz) driven onto the grade.
- **Persistence:** do **not** persist oxygen — resets full on load.

---

## 7. Particles `[M4]` — cheap, big presence multiplier

Empty water looks like a void; specked water looks *deep*. Three `THREE.Points`
systems, one draw call each, vertex-shader animated, only updated when
`submergence>0`:
- **Marine snow** — ~600–1500 motes in a ~12u box that **wraps around the eye** (mod
  position) → infinite for free; slow Brownian drift. The near-field parallax is the
  strongest depth cue underwater.
- **Rising bubbles** — upward velocity + `sin` wobble, respawn at the bottom.
- **Movement bubbles** — short bursts behind the player on swim input (reuse the
  splash pool).

---

## 8. Camera `[M4]` — polish, motion-only

In `CameraControls` / `gravityCamera` (thread a `getSubmerged` callback exactly like
the existing `getActiveUp`, `EfficientPlayer.tsx:987`), add `submergence`-scaled:
- lazy **roll** `sin(t·0.5)·0.015 rad` + tiny simplex,
- positional **sway** (~0.04u from desynced sines),
- breathing **FOV** (±0.6°, synced to the heartbeat at low O2).

Keep total roll <1° and FOV breathe <1° (sim-sickness); expose an intensity slider.
**Never** rotate the rigid body (overwritten each step) — camera layer only.

---

## 9. Quality gating — `config/graphicsSettings.ts`

Append knobs (the profile table is append-friendly):

| Knob | ULTRA | HIGH | MEDIUM | LOW | POTATO |
|---|---|---|---|---|---|
| `underwaterPostFX` (depth pass) | ✓ | ✓ | — | — | — |
| `underwaterCaustics` (in-scene) | ✓ | ✓ | ✓ | ✓ | — |
| `underwaterGodrays` | ✓ | ✓ | — | — | — |
| `underwaterParticles` | ✓ | ✓ | ✓ | — | — |
| `underwaterWobble` | ✓ | ✓ | — | — | — |

**Never gated** (define the *state*, must show on POTATO): the extinction-fog tint
(via `applyWaterMode`), audio muffle, swim physics, oxygen. Add `?underwater=1` debug
overrides beside the existing `?painterly`/`?ao`/`?outline` hooks (`App.tsx`).

---

## 10. File-by-file change map

| File | Change | New? |
|---|---|---|
| `state/playerSubmersion.ts` | `setPlayerSubmerged/getPlayerSubmerged` (clone `playerFrame.ts`) | **new** |
| `components/EfficientPlayer.tsx` | submersion detect (~:755); swim branch in step (:818-866); `terrainSeed` prop; oxygen tick (:912); `getSubmerged` to camera | edit |
| `components/EfficientScene.tsx` | pass `terrainSeed` to `EfficientPlayer` (:154) | edit |
| `utils/surfaceControls.ts` | `composeSwimVelocity` (3D look-aligned + drag) | edit |
| `utils/cubeGravityConstants.ts` | swim/buoyancy/drag constants | edit |
| `components/CameraControls.tsx` / `utils/gravityCamera.ts` | underwater roll/sway/FOV gated by submerged | edit |
| `components/effects/UnderwaterEffect.ts` | fullscreen pass: extinction + haze + wobble + godrays + wipe + vignette | **new** |
| `components/effects/PostFX.tsx` | inject `<Underwater>` before `<ToneMapping>` (:152); drive uniforms in useFrame | edit |
| `components/SkyController.tsx` | `applyWaterMode()` fog override (mirror `applySpaceMode`) | edit |
| `utils/voxelMaterial.ts` (or seabed material) | in-scene caustics injection | edit |
| `components/UnderwaterDome.tsx` | camera-attached Snell-window underside dome | **new** |
| `components/UnderwaterParticles.tsx` | marine snow + bubbles Points systems | **new** |
| `audio/sfxEngine.ts` | master lowpass + `setSubmerged` + splash/bubble events | edit |
| `audio/musicEngine.ts` | master lowpass + `setSubmerged` duck | edit |
| `components/audio/AudioDirector.tsx` | edge-trigger submerged → engines (:63) | edit |
| `game/systems/survivalVitals.ts` | `oxygen` field + tick + drown damage | edit |
| `components/hud/OxygenMeter.tsx` | breath ring (clone `JetpackMeter.tsx`) | **new** |
| `utils/mobileInput.ts` / `components/mobile/TouchControls.tsx` | `KEY_CODES.down` + DIVE button | edit |
| `config/graphicsSettings.ts` | underwater knobs (§9) | edit |
| `utils/waterProfile.ts` | derive `underwaterSigma`/tint/haze per planet | edit |

---

## 11. Build order — milestones (each independently shippable & verifiable)

- [x] **M0 — Spine.** `state/playerSubmersion.ts` + per-step eye-voxel detection +
  publish, computed in `EfficientPlayer` `useBeforePhysicsStep`. *Verify:* `?debug`.
- [x] **M1 — Feel (all tiers).** `composeSwimVelocity` (buoyant 6-DOF, blended by
  submergence) + swim-down `descend` key; master lowpass muffle + `splashEnter`/
  `splashExit` snap (edge-driven from `AudioDirector`); `applyWaterFog` override in
  `SkyController` (runs even on non-animated tiers).
- [x] **M2 — Look.** `effects/UnderwaterEffect.ts` (Beer-Lambert extinction + haze +
  god rays + wobble + vignette + crossing wipe), injected into the existing PostFX
  composer (ULTRA/HIGH), driven by `getUnderwater()` + sun-screen projection +
  edge-triggered wipe. `UnderwaterDome.tsx` Snell-window underside dome (all tiers).
  *(In-scene caustics deferred.)*
- [x] **M3 — Tension.** `oxygen` vital + `tickOxygen` (drain/refill/non-lethal HP
  bleed) + `hud/OxygenMeter.tsx` (low-O2 alarm) + the low-O2 vignette pulse driven
  onto the post pass.
- [x] **M4 — Presence.** `UnderwaterParticles.tsx` (marine snow + rising bubbles,
  GPU-animated, camera-wrapped, self-gated) + camera roll/nod sway in
  `CameraControls`; god rays shipped in M2.
- [x] **M5 — Ship.** Quality knobs (`underwaterPostFX`/`Caustics`/`Godrays`/
  `Particles`) + mobile DIVE button; swim/oxygen/persistence tests; `npm run verify`
  green (322 tests). **Deferred:** per-planet underwater palette from `waterProfile`
  (defaults used), in-scene caustics, and the headed before/after visual capture.

---

## 12. Tuning anchors (starting values — expect to tune in-game)

| Param | Start | Notes |
|---|---|---|
| `submergence` lerp | in 0.18s / out 0.12s | asymmetric → crisp threshold |
| buoyancy | 1.1 | >1 → slight net up = slow rise |
| water drag (linearDamping) | 3–6 | heavy/inertial feel |
| swim speed | ~3.5 m/s | vs 5 walking |
| terminal rise | ~1.5 m/s | gentle float-up, not a pop |
| extinction σ | `vec3(0.45,0.15,0.10)`/m | red half-dist ≈1.5m, blue ≈7m; murkier → raise + bring green up |
| fog density (underwater) | ~0.06–0.20 | FogExp2 override target ~0.12 |
| godrays | 48–64 samples, decay 0.95–0.97, weight 0.5, exposure 0.25 | GPU Gems 3 defaults |
| wobble amp | 0.003–0.008 of screen | larger reads as heat haze |
| audio lowpass | 18 kHz → 600 Hz, 80ms in / 150ms out | the clunk / gasp |
| oxygen | ~60s drain, ~15–20s refill, warn @25%, ~8 HP/s @0 | non-lethal |

---

## 13. Risks & decisions log

- **Two-composer hazard** → never run two `EffectComposer`s. Inject the underwater
  pass INTO PostFX when `postProcess`; otherwise fog-override only. The
  `NoToneMapping` swap is per-composer and would conflict.
- **Composer remount hitch** → keep the pass mounted, drive `uSubmergence=0` above
  water; don't add/remove the JSX child on submersion.
- **`FrontSide` water from below** → don't rely on water-face depth; the Snell dome is
  the surface-from-below source.
- **Body rotation overwrite** → all underwater tilt is camera-layer; never touch the
  rigidbody `setRotation`.
- **Cube vs sphere sea level** → use `isWaterVoxel` / dominant-axis, never
  `position.length()` (wrong near edges; this corrects the naive audio approach).
- **Static water** → dug channels don't fill in v1; documented limitation.
- **Two AudioContexts** → muffle ramps issued to each engine independently; no shared
  master across sfx + music.

---

## 14. References (verified)

- IQ *Better Fog* (extinction/inscatter, sun-dir color) — https://iquilezles.org/articles/fog/
- IQ *Domain Warping* — https://iquilezles.org/articles/warp/ · *fBM* — https://iquilezles.org/articles/fbm/
- IQ *Filterable Procedurals* (analytic AA) — https://iquilezles.org/articles/filterableprocedurals/
- IQ *Smooth Minimum* — https://iquilezles.org/articles/smin/
- Hoskins *Tileable Water Caustic* (`MdlXz8`) — https://www.shadertoy.com/view/MdlXz8 · Godot port — https://godotshaders.com/shader/water-caustic/
- Mitchell, *Volumetric Light Scattering as a Post-Process*, GPU Gems 3 ch.13 — https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process
- `three-good-godrays` (pmndrs-compatible) — https://github.com/Ameobea/three-good-godrays
- Snell's window (48.6° / 96° cone) — https://en.wikipedia.org/wiki/Snell%27s_window · Godot shader — https://godotshaders.com/shader/snells-window/
- Subnautica rendering (decoupled absorption) — https://www.gamedeveloper.com/design/how-i-subnautica-i-plunges-deeper-into-rendering-realistic-water
- Abzu seascapes (GDC 2017) — https://www.gamedeveloper.com/art/video-creating-the-striking-underwater-seascapes-of-i-abzu-i-
- Catlike Coding *Movement/Swimming* (buoyancy/drag/submergence) — https://catlikecoding.com/unity/tutorials/movement/swimming/
- Unreal water-entry (lowpass + post fade + droplet exit) — https://yelzkizi.org/water-simulation-in-unreal-engine/
- Oxygen Meter conventions — https://tvtropes.org/pmwiki/pmwiki.php/Main/OxygenMeter

---

## 15. Not yet done — deferred backlog

What shipped in M0–M4 is a complete, `verify`-green underwater experience. These are
the pieces we consciously left for follow-up, roughly in priority order. Each has a
concrete pickup path so it can be resumed without re-deriving anything.

### High value
- [ ] **In-scene world-projected CAUSTICS** (the dancing light net on the seabed).
  *Not built* — the post pass ships extinction/haze/godrays/wobble/vignette/wipe but
  no caustics, and the `underwaterCaustics` quality knob exists with **no consumer
  yet**. The Snell dome covers surface-from-below; the seabed light net is missing.
  *Pickup:* inject into `utils/voxelMaterial.ts` (shared module-singleton material —
  bump its `customProgramCacheKey` v4→v5) as an additive term gated by a new
  `uSubmergence` uniform (default 0 = exact no-op on land). Use the Hoskins `MdlXz8`
  field projected triplanar from the smooth-gravity up (so the net lies flat over any
  cube face), masked by `max(dot(N,up),0)*max(dot(N,sun),0)`, depth-faded by
  `getPlayerDepthBelow()`, `fwidth`-AA'd. Drive `uSubmergence` from `EfficientPlanet`'s
  existing useFrame (where `applyTerrainProfileToMaterial` already runs) and gate on
  `getGraphicsQuality().underwaterCaustics`. This is the signature element that also
  reaches MEDIUM/LOW (in-scene, no composer needed).
- [ ] **Per-planet underwater PALETTE** (decision #3, only partly honored).
  *Not wired* — `UnderwaterEffect` (`uSigma`/`uDeepTint`/`uHaze`/`uHazeSun`),
  `SkyController.applyWaterFog` (`UW_FOG_SHALLOW`/`UW_FOG_DEEP`), and `UnderwaterDome`
  (`uMirror`/`uSkyHorizon`/`uSkyZenith`) all use **hardcoded defaults**, so every
  planet's sea looks the same underwater. *Pickup:* derive from `utils/waterProfile.ts`
  (`buildWaterProfile(terrainSeed)` already yields linear `deepColor`/`shallowColor`)
  + `biomeProfile`. `UnderwaterEffect.setPalette(...)` **already exists** — call it from
  PostFX per seed; feed the dome + fog the same colours. Mind the sRGB↔linear
  convention (see [[color-management-double-convert]]).
- [ ] **Headed in-game VISUAL CAPTURE + GLSL runtime validation** (the
  material-quality-bar check, still owed). `npm run verify` bundles the shader strings
  but never *compiles* them — a GLSL error in `UnderwaterEffect`/`UnderwaterDome` would
  only surface at runtime in a browser. *Pickup:* run the headed harness (`?agent=1` /
  the screenshot path), submerge, and capture entry → underwater → exit across
  noon/golden/night + a couple of biomes, near and far; confirm the post pass + dome
  shaders compile and read well, then iterate on the §12 tuning anchors.

### Polish / smaller
- [ ] **Underwater ambient AUDIO bed** — only the muffle + `splashEnter`/`splashExit`
  one-shots shipped; the continuous underwater hum / bubble bed was not built.
  *Pickup:* repurpose the dormant `water` procedural bed in `musicEngine` (drive
  `waterGain` directly inside `setSubmerged`, bypassing the director that forces it to
  0) or add a looped noise bed on the sfx bus, gated on the submerged flag.
- [ ] **`?underwater=1` debug override** (§9) — not added. A URL override beside
  `?painterly`/`?ao`/`?outline` in `App.tsx` to force the underwater state on for
  inspection without having to find water. Small.
- [ ] **Camera breathing-FOV** — shipped roll + nod sway only; the gentle FOV breathe
  (synced to the heartbeat at low O₂) was skipped to avoid per-frame projection-matrix
  churn. Optional.
- [ ] **God-ray RAYMARCH (ULTRA variant, technique 4b)** — only the screen-space
  radial blur (4a) shipped; the raymarched variant that responds to occluders between
  eye and surface was always polish.
- [ ] **Exit-wipe droplet variant** — the crossing wipe is one distorted band for both
  directions; the drip-down-the-lens *exit* variant is simplified.
- [ ] **Feel/tuning pass** — every constant in §12 is a first guess (swim
  speed/drag/buoyancy, σ, fog density, oxygen timings, sway amplitudes). A real in-game
  tuning pass is owed once the visual capture above is running.

### ~~Known v1 limitation~~ — RESOLVED (see §16)
- ~~**Static water** — a player-dug channel won't "fill".~~ **Fixed 2026-06-24** by the
  dig-to-fill flow in §16.

---

## 16. Water generation — dig-to-fill flow + deep oceans (2026-06-24)

Two world-water fixes, both `verify`-green (332 tests).

### A. Dig-to-fill flow (`extendFloodForDugCell`)
Mining a block at/below the waterline next to water now **floods** it, cascading
through any connected sub-waterline space (a dug channel/shaft fills from the sea
and follows you down, Minecraft-style). Built on the static flood set so submersion
+ swimming work in player-made water for free, and dug channels **re-flood on reload**
(reconstructed from the persisted dig history).
- `proceduralWorldGenerator.extendFloodForDugCell(x,y,z,isLiveSolid)` — incremental
  BFS extending the cached flood with *live* terrain solidity (static terrain minus
  dug cells); `getDynamicWaterCells()` / `getWaterEditVersion()` for the renderer.
- `EfficientPlayer.commitMine` triggers it on each dig; `voxelSystem.getDeletedTerrainKeys()`
  + a `WaterBlocks` mount effect handle reload re-flooding; `WaterBlocks` renders the
  dynamic cells and reacts to the water version. Tests: `waterFlow.test.ts`.

### B. Deep oceans / ocean biome
Water was uniformly shallow because sea level is a *percentile of terrain tops*
(self-adjusts shallow). Now a **low-frequency ocean mask** blends the seabed toward a
**fixed floor radius** inside broad ocean regions, and **sea level is sampled from the
LAND surface only** (`getLandOffset`) so it stays high above the basins → consistent,
explorable depth on every seed (median ~6–14 world units, trenches to ~50), while small
land depressions OUTSIDE the mask still flood as **shallow puddles**. ~18% of the land
noise survives the blend → seabed ridges/seamounts (free relief). A hard
`MIN_SEABED_FRACTION` floor guarantees a solid bottom (no planet-eating). The **oceanic
archetype** is boosted into a true water world (more coverage, deeper, higher sea →
islands in a deep sea).
- Knobs (`config/worldGeneration.ts` `TerrainGenerationConfig`): `oceanFrequency`
  (raw-tangent freq, ~broad regions), `oceanCoverage` (mask threshold), `oceanDepth`
  (floor depth below land base), `oceanEdge` (shelf steepness). Oceanic override in
  `terrainConfig.ts`.
- Generation: `getLandOffset` (land noise, no ocean) + `oceanMaskAt` + the floor blend
  in `getProceduralSurfaceHeight`; `sampleSurfaceRadii` uses `getLandOffset`.
- **Deferred (per the §0 scope call):** seabed flora/creatures/features — terrain +
  relief only this pass; the existing seabed ore deposits + the underwater visuals
  (§5–§9) already make the deep explorable.
