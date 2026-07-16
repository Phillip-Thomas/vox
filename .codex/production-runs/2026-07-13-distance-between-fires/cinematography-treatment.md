# Cinematography Treatment — The Distance Between Fires

Author: Independent Cinematography Director  
Status: **ready_for_cross_notes**  
Contract target: `2026-07-13-distance-between-fires` / `cinematography-intent-v1`  
Prepared independently from the Score Director's first treatment: **YES** —
`score-treatment.md` was not opened or consulted before this treatment was
completed.

## Current-cut audit and visual thesis

- **Story-intent revision:** `intent-v1`, covering the exact shipped
  `anc.audit.arrival-handback` through `anc.hearth.freeplay-handback`.
- **Source revision:**
  `3d68948c18c7c362abb4ec66b74ff1c685bf2d1f+working-tree-20260714T003216Z`.
- **Authentic shipped evidence:**
  `captures/paravoxia-full-run.webm`, SHA-256
  `0ee1424793c0596b3b5527dd19512cd03129a6fb2fa40dd8d574d2651d62aee9`,
  753.28 seconds, VP8 1280×720, no audio. The reviewed arrival tail preserves a
  living origin, foreground tree and pond, distant wreck/relay cluster, W-7744's
  audit band, letterbox release, and a final player-owned frame. It proves
  sequence and current composition, not headed pointer-lock feel or taste.
- **Shipped/runtime camera references:** `storyDirector.ts:tickArrival`,
  `storyInputPolicy.ts`, `CameraControls.tsx`, `cinematicLook.ts`,
  `arrivalCinematography.ts`, `sideLens.ts`, `feedCamera.ts`, and the
  `ref-arrival-handback` / `ref-first-day-camera` records.
- **Render references:** `PostFX.tsx`, `UnderwaterEffect.ts`,
  `SkyController.tsx`, `realityRenderSystem.ts`, `graphicsSettings.ts`,
  `planetArtDirection.ts`, `planetVisualProfile.ts`, `PlanetProfile.ts`,
  `ShipCockpit.tsx`, `shipFlightFeedback.ts`, `SystemTravelDriver.tsx`, and
  `systemFlight.ts`.
- **Executable strengths to preserve:** one gravity-aware player-camera lineage;
  additive look guidance whose release returns to the player's persisted look;
  a world-space authored-pose seam that is inert at weight zero; 75° embodied
  and 70° cockpit baselines; a physical cockpit frame that survives FOV and
  portrait changes; continuous atmosphere-to-space lighting/fog; a depth-masked
  flight effect; one all-tier underwater fog signal with higher-tier extinction,
  haze, rays and particles layered above it; ACES applied exactly once; one
  planet-derived semantic palette; and a canonical, non-volcanic Tidegarden
  profile flowing through terrain, water, ecology, preview and atmosphere.
- **Current defects and unproved assumptions:** the only authentic baseline ends
  at arrival and has no audio; the baseline metadata records 50° and `alive`
  while `tickArrival` currently restores 75° and the governing story intent says
  the continuation begins at `material`; `SceneAvCueRail` is validated substrate
  but has no live scene consumer; `cinematicLook` remains a global writer;
  underwater camera sway does not presently show a reduced-motion gate;
  MEDIUM and below omit the unified grade/AO/outline; POTATO currently sets all
  flora, fauna, grass and tree density to zero, contradicting the required
  Tidegarden ecology floor; there is no DOF, true SSR, general volumetric fog,
  dynamic cast-shadow, or finished interior-acoustic/abundance system to hide
  weak blocking behind; headed exposure, mobile, touch, Potato and free-layout
  hearth evidence are absent.
- **Incoming continuity:** do not replay, trim, reframe, or relocate the shipped
  arrival. Begin on its exact player pose, look, W-7744 pose, world clock and
  landmark state. If the signed baseline confirms 50° at the actual handback,
  ease to 75° during the first open-play seconds; if live evidence confirms 75°,
  the same cue is an exact no-op.
- **Outgoing continuity:** free player camera at 75° inside or beside the actual
  certified Tidegarden habitat, all temporary camera/grade/bloom/outline/medium/
  flight/letterbox owners cleared, both worlds and the scarred ship returnable,
  and no completion tableau imposed on the player's chosen architecture.

### Direction A — Thresholds Remember

**Visual thesis:** every expansion of agency is seen through the material
boundary it changes—branch, fire, waterline, hull scar, hatch, atmosphere,
canopy, and finally a player-built opening—so the frame widens from one issued
purpose into a returnable relationship between two living worlds without ever
severing Terra's embodied gaze.

This is specifically Paravoxia because fidelity is causality. Color, material,
life density, water optics, cockpit scale and planetary atmosphere are not a
beauty montage; they are the protagonist's changing capacity to perceive. The
visual rhyme is not “bigger spectacle each chapter.” It is **a boundary first
experienced as a limit becoming an aperture without disappearing**. The tree
stays protected, the water remains costly, the ship keeps its scars, the origin
stays meaningful when small, and the new habitat remains an opening in a living
place rather than a claim over it.

### Authority reconciliation before implementation

The scene contract must resolve the baseline/runtime disagreement without
touching the shipped arrival:

1. `story-intent.md` is the new-scene authority: the first A4 life front alone
   commits `material → alive`.
2. `shipped-visual-baseline.json` is the evidence authority for the captured
   arrival: it labels the frame `alive` and 50°.
3. Current code defaults reality rendering to `alive`, while `tickArrival`
   appears to restore `SANDBOX_FOV` 75° on completion.
4. Therefore Packet 0 must capture the exact last arrival frame plus the first
   audit frame with live telemetry for stage, effects, FOV, camera owner and
   story milestone. The signed scene contract then reconstructs the intended
   `material` state without a visible pop and treats the 50°→75° opening cue as
   conditional/no-op from the measured incoming lens. No director may resolve
   this by restaging arrival or allowing life to flash before A4.

## Lens, authority and safe-area key

Three.js currently exposes vertical FOV, not a verified physical filmback. The
millimeter figures below are **notional equivalents on a 24 mm vertical
filmback**, used only to communicate lens character; executable truth remains
the vertical-FOV value and must be captured at the real viewport.

| Code | Executable FOV | Notional focal length | Character and allowed use |
| --- | ---: | ---: | --- |
| `L-body` | 75° | 15.6 mm | lived peripheral agency; on-foot default |
| `L-inspect` | 58° | 21.7 mm | close inspection without DOF; Maw setup only |
| `L-ritual` | 50–52° | 25.7–24.6 mm | deliberate ritual or one exterior calibration, never a default “cinematic” lens |
| `L-water` | 80–82° | 14.3–13.8 mm | medium expansion and bodily vulnerability; reduced motion stays at 75° |
| `L-cockpit` | 70° | 17.1 mm | pressure-shell baseline |
| `L-thrust` | 70–74°; boost ceiling 79° | 17.1–14.7 mm | vehicle-derived acceleration only; reduced motion 70–72° |
| `L-hearth` | 50–54° | 25.7–23.6 mm | optional player-initiated rest composition from actual geometry |

Camera authorities:

- `P`: player on-foot camera; look and route stay live.
- `P+L`: player camera plus bounded `cinematicLook` suggestion. Mouse/touch input
  continues underneath; reduced motion sets suggestion weight to zero.
- `C`: `cinematicCameraPose`, used only for the one final-calibration exterior
  reveal and always entered/exited under physical occlusion.
- `V`: vehicle/cockpit camera and real ShipController feedback.
- `O`: physical occlusion transfer. It is a transfer condition, not a black cut.
- `M`: movie mode using the same surface/swim/vehicle adapters; it may accept a
  stronger gaze suggestion but never supplies agency proof.

Safe areas:

- `S-body`: primary subject inside normalized viewport `x .24–.76 / y .18–.70`;
  top 18% remains available for audit/captions and bottom 24% for subtitles,
  hands, prompts and touch controls. Secondary landmarks may occupy the outer
  thirds but cannot carry required meaning alone.
- `S-cockpit`: destination/landing truth inside `x .30–.70 / y .20–.62`; the
  central 18% remains a clean boresight; critical readouts cannot hide behind
  canopy ribs or portrait crop.
- `S-mobile`: one primary subject at a time in the central 46% width; paired
  subjects use depth rather than opposite screen edges. Nothing required sits
  in the lower corner touch zones or beneath the top audit band.

## Color script and rendering causality

### Current semantic palette references

These are the **current resolver's candidate roles**, not a substitute for the
required deterministic atlas lock. They keep implementation anchored in live
code and make the two verdant worlds distinct by organization, value and
morphology rather than arbitrary recoloring.

| Role | Origin `-1,-1` | Tidegarden v1 `-1,-1:p1` | Continuity intent |
| --- | --- | --- | --- |
| sky low / high | `#68b676` / `#b4e4c6` | `#68a6b6` / `#b4d2e4` | origin leans warm green; sibling leans humid cyan-blue |
| terrain primary / secondary | `#587836` / `#65994d` | `#36786c` / `#4d9699` | earth-and-leaf origin versus wet turquoise terraces |
| canopy base / tip | `#299932` / `#50c96f` | `#1f54a3` / `#4464d5` | green crown versus cobalt/blue-violet fan canopy |
| water deep / shallow | `#0d302a` / `#59c5c1` | `#0d2a30` / `#59a1c5` | green-teal pond versus lapis-blue braided shallows |
| bark / shelf light | `#60452f` / `#bfa77d` | `#60452f` / `#bfa77d` | shared material ancestry; Tidegarden uses ivory shelves at larger scale |
| reproductive accent | `#b63ee5` | `#e53ea4` | scarce violet origin accent versus scarce coral/magenta sibling accent |
| machinery | regulation ember `#ff5a3c`; repair cyan | cockpit amber `#ff9a47`; repair/navigation cyan | technology stays a limited focal language, never a biome wash |

The Tidegarden `hazardAccent` generated by the generic palette is not an
environmental instruction: its canonical hazard is `none`. Do not seed orange
danger cues into the landscape merely because that role exists in the shared
type.

| Beat / anchor range | Palette family and semantic roles | Light, fog and material state | Grade/effect causality | Earned reality meaning |
| --- | --- | --- | --- | --- |
| `ch4-audit` / `anc.audit.arrival-handback→directive` | origin material dawn; warm green earth, cool pond, W-7744 ember as the only regulation accent | preserve shipped dawn direction and landmark values; W-7744 remains separated from vegetation by ember/value, not a spotlight | no stage change; exact arrival grade continues; directive may add bars, never CCTV treatment | another observer occupies the same world but cannot perceive its relationships |
| `ch4-comply` / `fire-order→regression-floor` | origin roles progressively lose separation; fire amber is physically removed first | material preset scales toward `0.66` after fire and `0.40` after organics over six seconds each; organic is floored at `0.30` so life sickens rather than pops out | world uniforms/material response carry the loss; a mild unified grade follows but is not the evidence; no bars and no flash | compliance is self-diminishment performed by the player's hands |
| `ch4-defy` / `tree-order→no-committed` | regression floor; tree reads by stable silhouette and bark/sky value, not special saturation | still dawn, low movement, no hero rim light; the protected target remains materially present | harmless tool refusal is local sparks/beam collapse only; after `no.` hold all effects and camera motion still | will is a small act inside the diminished world, not a spectacle |
| `a4-exhale` / `held-stillness→handback` | floor → full origin alive palette: dawn gold, green canopy, turquoise water, rare violet flower/fauna accents | front begins at the hero tree; geometry grows, wind bows, water amplitude wakes, herds cross the ridge under the same sun | persisted `alive` authority drives life visibility; uniform front/gust/water changes are primary; bloom only punctuates already-visible material change and has an emissive/light fallback | life was accessible beyond the prior renderer; it was not manufactured by technology |
| `ch5-maw` / `pack-attended→pond-resonance` | moss/wet bark, dead iron, W-7744 ember remnants, scarce repair cyan | open alive daylight; pack and torn branch share one depth plane; fractures remain dark until traced | fracture field and physical segment re-registration disclose repair; local cyan emissive carries every tier; bloom is optional punctuation | power wakes but waits for chosen direction |
| `ch6-dive` / `waterline→shore-bank` | origin turquoise surface → teal column → indigo depth; Keel amber stays high-value | one continuous water signal drives FogExp2 on all tiers; high tiers add depth extinction/haze/rays; surface aperture remains geometrically present | submergence causes the medium; oxygen adds shape/pulse edge language; no pickup bloom; medium opens only on actual surfacing | the body turns distance into cost; return to air, not loot, is release |
| `ch7-reconstruct` / `diagnosis→calibration` | afternoon earth, oxidized hull, cyan repair seams, amber cockpit interior | one scarred object under continuous world light; each stage changes silhouette, contact and emissive topology | AO may ground on High; lower tiers use contact geometry/value; no pristine model swap, painterly pass or fake shadow; seam intensity settles after each commit | repair reinterprets inherited machinery without erasing history |
| `ch7-board` / `hatch-enter→cockpit-handback` | exterior origin palette compressed into cool hull frame and amber/cyan cabin | hatch/canopy physically occlude the world; pressure seal briefly removes exterior luminance before cabin recovery | no black overlay; occlusion and exposure adaptation are geometry/material events | camera ownership changes because Terra entered a body, not because a scene loaded |
| `ch8-launch` / `ignition→atmosphere-exit` | origin green/gold → thinning cyan atmosphere → indigo-black local space | existing altitude blend continuously thins fog and moves key/fill toward space values | flight feedback derives from thrust; no exterior cut, warp tunnel, white flash or radial hyperspace grammar | the ground becomes a whole world without becoming less |
| `ch8-crossing` / `origin-lookback→approach` | black-indigo interval with origin green-gold behind and Tidegarden lapis/turquoise ahead | both bodies retain coherent star direction; destination profile grows from impostor to exact atmosphere/terrain | technical handoff hides only behind the destination's physical limb/atmosphere; sparse depth-masked dust/streaks may show speed, never A5 | distance reveals relation rather than erasing origin |
| `ch8-landfall` / `touchdown→handback` | humid cyan-blue sky, turquoise terraces, warm ivory shelves, cobalt fans, scarce coral life, amber/cyan ship | readable oblique daylight for first contact; wet surfaces and layered depth remain legible without reflections or grade | body silhouette, water boundaries and moving route proxies establish abundance before text; no landing bloom or chapter toast | a second living world is different, safe and already occupied by relationships |
| `ch9-settle` / `scanner-overload→shelter-certified` | Tidegarden hierarchy remains; scanner cyan traces relationships while build material stays ivory/stone/biofiber | daylight moves toward ecological night; resource accents are selected, never all glowing at once; habitat core adds bounded warm ivory/amber | extraction/placement changes physical geometry and local route response; building never alters camera; no morality grade | abundance creates choices about adjacency, not entitlement |
| `ch9-hearth` / `ecology-night→freeplay-handback` | cobalt exterior, lapis water, coral/cyan life traces, warm ivory/amber interior; origin, when visible, remains green-gold | night is an acoustic/ecological/value transition, never a cold-death blue wash; sheltered foreground keeps exterior life visible | shelter attenuation, eave motion and local work light carry the threshold; optional rest composition uses actual opening; no painterly finish or major “completion” glow | home is the maintained relation between places, not a replacement world |

## Shot ledger — Direction A

Rows are **segments of one camera lineage**, not permission to insert hard cuts.
Unless a row explicitly says `O`, the previous frame must transform continuously
into the next. Every shot ID is stable and binds to the story anchors rather
than duplicated wall-clock seconds.

### `ch4-audit` — inspection in the inherited frame

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.audit.01-inherited-world` | `anc.audit.arrival-handback→anc.audit.fire-check` | 1 W-7744 beginning his grounded route; 2 persisted tree/pond/wreck cluster; foreground tree from the shipped frame may occlude but not erase him | `P` | measured incoming 50° or 75° → `L-body` in 1.8 s smoothstep; exact no-op if already 75° | player follows freely; no pose or corrective snap | no cut; `S-body/S-mobile`; preserve the exact first pixel of the handback, exit 75° |
| `cin.audit.02-warmth-without-fire` | `anc.audit.fire-check→anc.audit.life-as-noise` | 1 persisted fire source/absence and W-7744's reaction; 2 Terra's living ground; W stands on validated dry support | `P` | 75° | NPC moves only by grounded route; camera remains free; accessible Attend may center by player request | no bars; offscreen indicator only when subject is out of view; exit unchanged |
| `cin.audit.03-noise-field` | `anc.audit.life-as-noise→anc.audit.tree-distance` | 1 W-7744 visually separated by ember against life; 2 grass/forage motion he calls noise; tree waits in depth | `P` | 75° | lateral/diagonal follow creates parallax between body and “noise”; never slide or lerp the NPC to height | optional two-frame bare mismatch may recur only if Story signs it; no meaning depends on it; exit unchanged |
| `cin.audit.04-object-not-there` | `anc.audit.tree-distance→anc.audit.directive` | 1 physical gap W-7744 refuses to close; 2 hero tree at stable high-value silhouette; 3 player free in the triangle | `P`, directive emphasis uses bars only | 75° | W stops; the still spatial gap is the composition; bars ease over 0.35 s only for the final directive | no camera pull; `S-body`; bars clear within 0.5 s of directive or explicitly transfer, FOV 75° |

### `ch4-comply` — open-play regression

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.comply.01-fire-in-hand` | `anc.comply.fire-order→anc.comply.fire-commit` | 1 persisted fire interaction in reachable lower-middle; 2 W-7744 remains present, not framed as a chooser | `P` | 75° | normal approach and interaction; no guided gaze | physical dousing removes the warm accent; no bars/cut; camera unchanged |
| `cin.comply.02-first-diminishment` | `anc.comply.fire-commit→anc.comply.organics-order` | 1 dark wet fire remains; 2 world value separation visibly contracts around it | `P` | 75° | uniform/material drain to 0.66 over 6 s smoothstep while the player can move | grade follows world state, never leads it; no life pop; exit at settled step one |
| `cin.comply.03-given-away` | `anc.comply.organics-order→anc.comply.organics-commit` | 1 Terra/W-7744 transaction distance; 2 inventory-held organics represented by hand/object or explicit absence state | `P` | 75° | player performs the command; no camera movement or UI takeover | `S-body`; empty-inventory resolution still shows W and the dim world, not a detached menu |
| `cin.comply.04-nothing-looks-better` | `anc.comply.organics-commit→anc.comply.regression-floor` | 1 the diminished landscape itself; 2 extinguished fire and tree stay materially present | `P` | 75° | second 6 s smoothstep to 0.40 with organic floor 0.30 | no vignette/mono shortcut; low tier uses the same material values; exit with no temporary camera owner |

### `ch4-defy` — the smallest possible shot

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.defy.01-impossible-order` | `anc.defy.tree-order→anc.defy.tool-refusal` | 1 hero tree as ordinary persistent geometry; 2 harmless Maw alignment; W remains behind or lateral, never sharing the aim line | `P` | 75° | player approaches/aims; a world-space indicator appears only while the tree is offscreen | beam collapses locally with no tree damage, bloom or recoil spectacle |
| `cin.defy.02-verb-arrives` | `anc.defy.tool-refusal→anc.defy.refuse-available` | 1 contradiction between intact tree and issued target; 2 lowercase interaction in normal prompt space | `P` | 75° | no authored motion; escalation lives in blocking and stillness | no false branch framing; `S-body/S-mobile`; tree remains target-safe |
| `cin.defy.03-no` | `anc.defy.refuse-available→anc.defy.no-committed` | 1 the player's actual interaction; 2 bare `no.` with the tree still visible if the player's view allows | `P` | 75° | on commit, hold input state and camera result without recentering | no bloom, flash, shake or push-in; caption has clean top/bottom separation |
| `cin.defy.04-the-quiet` | `anc.defy.no-committed→anc.a4.held-stillness` | the player's current frame becomes the composition; nothing new competes | `P` with movement held by Story, look unchanged | 75° | absolute visual stillness for the contracted 1.5 s; pause/focus freezes it | letterbox may begin only after the committed word; no early life motion |

### `a4-exhale` — life crosses the same frame

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.a4.01-held-field` | `anc.a4.held-stillness→anc.a4.life-front` | 1 drained world in the player's retained frame; 2 W-7744's single backward step if visible | `P` | 75° | first stillness remains camera-inert; no automatic “find the tree” snap | bars settle; prewarmed life remains reveal-zero, not hidden by unmount |
| `cin.a4.02-first-breath` | `anc.a4.life-front→anc.a4.pond-wakes` | 1 first bowing/growing life at the front; 2 front direction toward the pond; tree remains causal center even if offscreen | `P+L` manual max weight .42, `M` may reach .85 | 75° fixed | surface-gaze solver suggests feet/front then pond over 2.5–4 s ease-in/out; player input continues; reduced motion weight 0 | geometry/material front is evidence; no-post version identical in meaning; no roll |
| `cin.a4.03-water-learns-light` | `anc.a4.pond-wakes→anc.a4.herd-crest` | 1 physical pond amplitude/reflection response; 2 ridge negative space prepared for herd | `P+L` manual max .32 | 75° | target glides along the causal radius, never teleports between look targets | water change precedes any optional bloom; `S-body`; mobile shows pond then ridge sequentially |
| `cin.a4.04-the-ridge-arrives` | `anc.a4.herd-crest→anc.a4.w7744-flight` | 1 herd silhouettes locomoting over the ridge; 2 W-7744's failure to register them | `P+L`, reduced motion `P` | 75° | brief horizon suggestion, then weight returns to zero before W runs | no creature fade-in; Potato uses canonical herd/route silhouettes; no god-ray dependency |
| `cin.a4.05-empty-field-flight` | `anc.a4.w7744-flight→anc.a4.pack-torn` | 1 W-7744 crossing living ground; 2 grass/branch physically changing his route; 3 dry landing patch for pack | `P`; `M` may pan but must preserve surface horizon | 75° | player look is live and movement releases during this movement; offscreen direction cue replaces force | no chase camera; W uses constrained motion and dry-ground support; branch collision is readable without intent |
| `cin.a4.06-cause-left-behind` | `anc.a4.pack-torn→anc.a4.handback` | 1 torn strap, branch and pack in one causal depth stack; 2 W receding, not privately explained | `P` | 75° | optional look suggestion ≤.25 for 1.2 s only if pack is already near view; otherwise indicator | bars, gaze, density ramp overrides and temporary bloom clear; full on-foot control at handback |

The inherited A4 rhythm is stillness near 6 s, front near 6–26 s, flight near
26–40 s. Those seconds are audition targets, not replacement anchors; the
semantic order above is authoritative.

### `ch5-maw` — capability waits for direction

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.maw.01-follow-the-tear` | `anc.a4.handback→anc.maw.pack-attended` | 1 displaced grass/torn branch/pack relationship; 2 W's route receding; no objective pillar | `P` | 75° | player chooses route; guidance escalates sound → motion/contrast → indicator → marker | no camera pull; pack sits on validated dry flat ground; marker clears when visible |
| `cin.maw.02-open-the-pack` | `anc.maw.pack-attended→anc.maw.kit-acquired` | 1 unique kit and chromatic fault record; 2 torn strap as cause; no motive inference | `P` | 75° | close by player movement, not zoom | local reflection/emissive readable with post off; inventory commit does not cut away |
| `cin.maw.03-find-the-catch` | `anc.maw.kit-acquired→anc.maw.repair-begun` | 1 same wreck cradle and Faulty Maw; 2 Terra's hand finding the catch; surroundings provide negative space | `P+L` | 75°→58° over .8 s smoothstep after player initiates | camera eye never relocates; manual suggestion max .35; crafting window closes before the visual cue | interrupted start returns to 75° and consumes nothing |
| `cin.maw.04-segments-remember` | `anc.maw.repair-begun→anc.maw.repair-committed` | 1 stable Maw center; 2 separating/re-registering segments; 3 fracture trace | `P+L` manual max .55, `M` .9 | 58°→52° over 1.2 s; hold 52° | eight-second physical ritual; target remains in `S-body`; no DOF claim | no hard cut; score-scheduled bloom, if any, follows visible beam formation and requires cyan emissive/local-light fallback |
| `cin.maw.05-tool-without-order` | `anc.maw.repair-committed→anc.maw.direction-handback` | 1 brief formed beam not striking a target; 2 self-powered readout; environment remains open | `P+L→P` | 52°→75° over 1.4 s ease-out | gaze weight reaches zero before any stone/tree highlight; movement/look return together | clear repair grade/bloom/outline cues; committed state persists; target selection remains player's |
| `cin.maw.06-an-answer-under-water` | `anc.maw.direction-handback→anc.maw.pond-resonance` | 1 whatever the player chooses to test or withhold; 2 restrained pond ripple/resonance when near | `P` | 75° | no camera correction toward pond; directional indicator only while offscreen | resonance is surface/material motion plus icon/caption fallback, not bloom alone; exit unchanged |

### `ch6-dive` — one waterline, two clocks

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.dive.01-cross-the-line` | `anc.maw.pond-resonance→anc.dive.waterline` | 1 actual water boundary; 2 surface anomaly; 3 shore as remembered return path | `P` | 75° | player enters; no roll, cut or teleport | water collision/submergence is the only trigger; dry-air frame retained for continuity |
| `cin.dive.02-air-stays-above` | `anc.dive.waterline→anc.dive.oxygen-authored` | 1 refracting surface/Snell aperture; 2 descending route; oxygen appears after meaningful submersion | `P` | 75°→82° over 1.2 s; reduced motion 75° | current look remains; all underwater sway/wobble must honor reduced motion | FogExp2 and geometric aperture carry Potato; high-tier wipe/extinction are additive; no hue-only evidence |
| `cin.dive.03-counting-body` | `anc.dive.oxygen-authored→anc.dive.keel-revealed` | 1 amber Keel trace inside drowned hull; 2 route clearance; fish/current may cross but never become waypoint | `P` | 82° | free 3D swim; no forced gaze; indicator uses depth/shape/direction | oxygen edge pulse, numeric state and caption share one signal; core visible without bloom |
| `cin.dive.04-free-the-memory` | `anc.dive.keel-revealed→anc.dive.keel-freed` | 1 Maw contact on structural pin; 2 Keel object; 3 remaining oxygen budget | `P` | 82° | cancel-safe held action; camera stays live | no pickup sting, zoom or completion bloom; physical release and inventory commit are distinct |
| `cin.dive.05-look-back-if-chosen` | `anc.dive.keel-freed→anc.dive.surface` | 1 open-air aperture/route home; 2 freed object state | `P`; `M` may hold the Snell aperture for ≤2 s then swim honestly | 82°→75° only as eye exits | player turns and ascends; movie route remains 3D and collision/O2 legal | no rescue teleport; reduced motion has no sway; surface event, not inventory, opens medium |
| `cin.dive.06-open-air-release` | `anc.dive.surface→anc.dive.shore-bank` | 1 horizon/shore and recovering breath; 2 water behind; Keel remains carried, not toasted | `P` | settle 75° within 1 s | medium/fog release eases over about 1 s; camera motion remains player-derived | any bloom waits until oxygen is safe and uses local material fallback; exit dry, open and 75° |

### `ch7-reconstruct` — the scar is the cut

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.reconstruct.01-wreck-remembers` | `anc.dive.shore-bank→anc.reconstruct.diagnosis` | 1 persistent wreck silhouette and chosen scar; 2 Keel projection relationships; no detached progress board | `P` | 75° | player walks the hull; wounds disclose only near look | world remains one long take; projection lines have shape/value fallback and clear when not relevant |
| `cin.reconstruct.02-bench-wakes` | `anc.reconstruct.diagnosis→anc.reconstruct.bench-online` | 1 physical Keel socket/bench; 2 scarred spine; 3 dormant station lights | `P` | 75° | player installs; no camera move | bench changes silhouette/light/sound; no victory pulse; exact persisted stage on exit |
| `cin.reconstruct.03-bearing-weight` | `anc.reconstruct.bench-online→anc.reconstruct.frame-restored` | 1 landing gear taking weight and straightening spine; 2 retained crash deformation | `P` | 75° | free repair long take; physical parts move only after atomic commit | contact/value change carries lower tiers; no hovering model swap |
| `cin.reconstruct.04-boundary-seals` | `anc.reconstruct.frame-restored→anc.reconstruct.hull-sealed` | 1 panes/biocomposite enclosing pressure volume; 2 old scar retained across new skin | `P` | 75° | player circles/installs | glass harmonic look uses rough faceted material, not unbuilt transmission/SSR; stage reconstructs on reload |
| `cin.reconstruct.05-pulse-enters` | `anc.reconstruct.hull-sealed→anc.reconstruct.lift-online` | 1 lift-cell seat and low engine pulse; 2 gear remains on validated ground | `P` | 75° | no lift before authoritative commit | cyan/amber local emissive with material fallback; no FOV or camera cue |
| `cin.reconstruct.06-ground-relents` | `anc.reconstruct.lift-online→anc.reconstruct.first-hover` | 1 real first-person rise toward upper socket; 2 hull/body clearance; ground visibly separates | `P` | 75° | actual suit-thrust controller; natural gaze stays near horizon/goal, never at ground across a face edge | no teleport, exterior cut or flight smear; legal hover event alone advances |
| `cin.reconstruct.07-route-becomes-intention` | `anc.reconstruct.first-hover→anc.reconstruct.route-online` | 1 upper route/logic socket reached by the earned hover; 2 cockpit/nav lights joining into one path | `P` | 75° | player installs and returns to ground/valid hull footing | route capability and visible nav topology commit together; no sibling preview before this anchor |
| `cin.reconstruct.08-ready-is-not-departed` | `anc.reconstruct.route-online→anc.reconstruct.calibration` | 1 complete scarred ship under ordinary world light; 2 player initiation point | `P` | 75° | free inspection until explicit calibration command | no auto-cut on `flight_ready`; egress/pad validation may block calibration honestly |
| `cin.reconstruct.09-one-exterior-reveal` | `anc.reconstruct.calibration`, 0–9 s | 1 restored spine and surviving scar; 2 validated gear/contact; 3 origin landmark context | `O→C→O`, player-initiated only | 52° | maintenance iris/canopy mullion fills ≥90% frame; 0.35 s ease into low three-quarter; 7–9 s boom along spine; return through canopy/hatch occlusion | the **only** exterior hero camera; `S-body/S-mobile`; reduced motion uses one static 52° exterior plate or static first-person reveal; on exit clear pose and restore exact 75° look |

### `ch7-board` — ownership passes through matter

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.board.01-enter-the-scar` | `anc.board.hatch-enter→anc.board.camera-transfer` | 1 physical hatch and threshold; 2 exterior origin in peripheral context | `P→O` | 75° | player initiates and moves/animates into the hatch; hatch reaches ≥90% viewport coverage | if collision/focus/pause interrupts before transfer, restore validated exterior pose, 75°, no black blink |
| `cin.board.02-one-owner` | `anc.board.camera-transfer→anc.board.pressure-seal` | hatch interior fills frame; no competing world subject | `O→V` atomically at the signed occlusion threshold | 75° owner ends; vehicle initializes at 70° behind occlusion | no spatial camera interpolation between unrelated parents while visible | on transfer, on-foot input/camera writer is disabled before vehicle writer begins; exactly one owner |
| `cin.board.03-pressure-boundary` | `anc.board.pressure-seal→anc.board.cockpit-handback` | 1 canopy opening onto the actual parked world; 2 amber/cyan controls; 3 old scar visible in frame detail where possible | `V` | 70° | seal clears and exposure settles; no camera shake | no black overlay; handback only after physical seal; cockpit controls and pointer lock live at exit |

### `ch8-launch` — the ground leaves from inside the ship

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.launch.01-engine-finds-weight` | `anc.launch.ignition→anc.launch.liftoff` | 1 horizon/landing reference through canopy; 2 cockpit throttle/engine response; no exterior coverage | `V` | 70°→up to 74° only from real thrust; reduced 70–72° | controller-derived vibration ≤ existing bounds; no story-authored push | ignition does not bloom to white; `S-cockpit`; aborted ignition settles exactly to 70° |
| `cin.launch.02-world-below` | `anc.launch.liftoff→anc.launch.atmosphere-exit` | 1 ground physically receding; 2 cube face/limb becoming legible; cockpit remains near-depth anchor | `V` | feedback-driven 70–74° | player steers; atmosphere fog thins continuously; no exterior cut or auto-lookback | no flight smear before deep space; stage/grade owners follow altitude, not a timer |
| `cin.launch.03-boundary-without-warp` | at `anc.launch.atmosphere-exit` into crossing | 1 origin limb and black interval in one frame when player permits; 2 cockpit | `V` | returns toward 70° if thrust settles | existing atmosphere-space blend completes with no flash or camera snap | legal exit commits; origin remains renderable behind; all surface-only cues cleared |

### `ch8-crossing` — two bodies, one cockpit

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.crossing.01-room-to-look-back` | `anc.launch.atmosphere-exit→optional anc.crossing.origin-lookback / anc.crossing.sibling-targeted` | 1 chosen flight direction; origin remains coherent behind; no forced souvenir frame | `V` | 70° with normal feedback | free roll/orbit/cut thrust; no camera correction | optional lookback records only after stable player dwell; absence does not block targeting |
| `cin.crossing.02-one-world-behind` | optional `anc.crossing.origin-lookback` | 1 whole origin cube at 10–24% frame height; 2 canopy/cockpit proving embodied distance | `V` | 70° fixed; no zoom reward | player-created hold only | no bloom, bars or forced thought timing; origin keeps warm material palette rather than fading to grey |
| `cin.crossing.03-another-world-ahead` | `anc.crossing.sibling-targeted→anc.crossing.local-handoff` | 1 physical sibling body growing in `S-cockpit`; 2 target/navigation response; origin remains correct behind | `V` | 70–79° from real boost; approach limiter releases toward 70° | depth-masked distant smear and cockpit dust may respond to speed; central boresight stays clean | no tunnel, radial starburst, chromatic warp or A5 white; target identity comes from canonical profile |
| `cin.crossing.04-limb-handoff` | at `anc.crossing.local-handoff` | 1 destination limb/atmospheric shell occupying enough forward frame to hide only the renderer ownership transfer; 2 cockpit rigid and unchanged | `V` | 70°; flight feedback damped, not snapped | transfer waits for valid aim/envelope and a coherent occlusion window; pose/quaternion/star direction remain authoritative | exact-shell/terrain replaces proxy behind physical coverage; no full-screen flash; if lease fails, remain in local space with no visual jump |
| `cin.crossing.05-another-key` | `anc.crossing.local-handoff→anc.crossing.approach` | 1 Tidegarden water/terrace/canopy hierarchy resolving from body to place; 2 landing corridor; cockpit | `V` | 70–72° | atmosphere and terrain detail arrive by distance; no montage | candidate palette precedes biome label but never precedes canonical profile readiness; exit in controlled approach |

### `ch8-landfall` — first contact is manual

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.landfall.01-read-the-ground` | `anc.crossing.approach→anc.landfall.touchdown` | 1 selected dry pad and clear egress; 2 wet hills/water boundaries; 3 canopy scale | `V` | 70°; reduced max 72° | player or same-controller assist descends; no external landing shot | slope/water/prop/fauna-corridor validation is visible truth; invalid approach returns to air |
| `cin.landfall.02-weight-on-another-world` | `anc.landfall.touchdown→anc.landfall.egress` | 1 gear contact and settled horizon; 2 living movement beyond pad | `V` | damp to 70° | contact response without victory shake | no chapter modal or landing bloom; park pose persists before exit prompt |
| `cin.landfall.03-hatch-to-air` | `anc.landfall.egress→anc.landfall.first-footfall` | 1 physical hatch threshold; 2 local ground through opening | `V→O→P` | 70°→75° behind ≥90% hatch occlusion | exact inverse of boarding; no black blink | validate player footprint and dry support before camera owner changes; interruption restores cockpit |
| `cin.landfall.04-world-before-thought` | `anc.landfall.first-footfall→anc.landfall.handback` | 1 actual local ground/near water or shelf; 2 ship as return path; 3 canopy/fauna route | `P` | 75° | first step and turn are player-owned; the world moves first | no authored pan; Potato route/canopy silhouettes preserve abundance; exit free at 75° |

### `ch9-settle` — abundance becomes composition

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.settle.01-too-much-signal` | `anc.landfall.handback→anc.settle.scanner-overload` | 1 selected relationship/deposit under aim; 2 lines to root/water/route; everything else suppresses to quiet topology | `P` | 75° | player scans freely; no focus steal | overload is density of legible links, not full-screen noise; high-contrast icons/line styles survive color loss |
| `cin.settle.02-see-one-relation` | `anc.settle.scanner-overload→anc.settle.relationship-attended` | 1 one deposit plus what uses/shelters it; 2 wider abundance; no morality halo | `P` | 75° | composition/motion → sound → reciprocal behavior → indicator → accessible Attend | manual observation never moves camera; marker clears on visibility; Keep/Compare/Doubt remain optional |
| `cin.settle.03-three-kinds-of-neighbor` | `anc.settle.relationship-attended→anc.settle.site-chosen` | canopy shelf, limestone ridge and lagoon terrace each disclose a different foreground/midground relationship without a “correct” beauty shot | `P` | 75° | player traverses and chooses; validators, not camera framing, certify | no site is privileged by brighter grade or forced route; all retain origin-sky possibility as a candidate, not a gate |
| `cin.settle.04-question-on-the-ground` | `anc.settle.site-chosen→anc.settle.first-foundation` | 1 legal placement footprint and preserved nearby relationship; 2 ship/egress context | `P` | 75° | ordinary build camera; placement ghost follows player aim | commit causes local dust/contact/material response only; no camera kick, badge or counter |
| `cin.settle.05-built-of-here` | `anc.settle.first-foundation→anc.settle.core-online` | 1 chosen mixed local material and actual emerging layout; 2 habitat-core placement; 3 living exterior | `P` | 75° | free build sequence; no imposed shot order | material roles, collision and enclosure remain truthful with post off; core light stays bounded |
| `cin.settle.06-wind-finds-another-path` | `anc.settle.core-online→anc.settle.shelter-certified` | 1 actual roof/eave/opening response; 2 warm core inside; 3 route/water/life still visible outside where geometry allows | `P` | 75° | certification does not move camera; environmental attenuation changes around the player | no blueprint counter; physical shelter cues precede any text; exit with chosen layout unchanged |

### `ch9-hearth` — no canonical final frame

| Shot ID | Start / end anchors | Focal hierarchy and blocking | Authority | Lens | Motion / easing | Transition, safe area and exit |
| --- | --- | --- | --- | --- | --- | --- |
| `cin.hearth.01-living-night` | `anc.settle.shelter-certified→anc.hearth.ecology-night` | 1 threshold between warm work volume and moving exterior; 2 player-chosen material/opening; no lethal hazard cue | `P` | 75° | player lives through the change; no forced wait pose | cool exterior/warm interior separation survives grade-off; no cold-damage vignette |
| `cin.hearth.02-safe-because-built` | `anc.hearth.ecology-night→anc.hearth.safe-rest` | 1 actual rest point inside certified volume; 2 core/eave/door evidence; 3 exterior life persists | `P` | 75° | player initiates rest; shipped neutral sleep fade may cover checkpoint reconstruction but cannot replace geometry | no timer-only exterior completion; interruption returns to free camera in the same layout |
| `cin.hearth.03-opening-between-worlds` | optional `anc.hearth.window` | preferred: real opening with warm habitat foreground, origin world small beyond, and Tidegarden life in middle distance; alternate: real doorway/eave with ship/route and the two-world material relation | `P+L`, player-initiated only | 75°→52° in 1.2 s, hold ≤6 s, return 1.2 s; reduced motion 75° | candidate look target is selected from actual rest-eye geometry; look weight ≤.35 and player input wins | never fabricate/move a window, origin, wall or camera; if no truthful sightline, use alternate or omit; no story dependency |
| `cin.hearth.04-the-line-remains-open` | `anc.hearth.safe-rest / optional anc.hearth.window→anc.hearth.freeplay-handback` | the player's current valid frame, not a director-selected postcard | `P` | exact 75° | optional composition releases fully; no final dolly or fade to credits | clear every cue owner and modal; preserve both worlds, route, ship and structures; free play starts in place |

## Free-layout hearth framing algorithm

The final habitat cannot be authored around one screenshot. The optional window
shot is a deterministic **selection over the player's real structure**, never a
camera teleport or geometry correction.

1. Build candidates from validated rest-eye positions and actual openings:
   doorway, window-sized portal, eave gap, or open wall boundary. A candidate
   must pass collision, near-plane and enclosure queries and must not see through
   a closed voxel.
2. Raycast the origin direction using the live celestial transform. Score
   visible-origin candidates by: unobstructed opening, 8–28% origin occupancy,
   warm interior foreground, Tidegarden middle-distance relationship, horizon
   level, and `S-body/S-mobile` caption clearance. Never alter the structure to
   improve the score.
3. If no origin candidate passes, rank truthful threshold alternatives: habitat
   core plus real exterior route/water, ship plus opening, or two local material
   families meeting at the shelter boundary. This visually preserves relation
   and return without pretending the origin is visible.
4. A compact sealed habitat remains fully valid. Its restrained alternative is
   the warm core against actual roof/wall material followed by immediate player
   handback; the absence of a postcard cannot reduce certification or story
   meaning.
5. Tie-break deterministically by structure ID and candidate coordinate so
   replay/reload matches until the player edits the structure. Recompute only
   after a committed edit, never per frame.
6. The cinematic appears as an optional `Attend / Rest view` action after safe
   rest. It does not auto-fire, does not create an observation by itself, and
   cancels immediately to the player's persisted look on input, pause or focus
   loss.

## Post-FX, lighting and render-causality ledger

`SceneAvCueRail` may own only its declared `fov`, `grade`, `bloom`, `outline`,
`underwater_medium`, and `flight_feedback` channels. World geometry/material
events remain owned by authoritative gameplay/story events. Existing
letterbox/sleep-fade overlays remain explicit Story owners. No scene writes
fixed `PostFX` globals or creates a second camera state machine.

| Cue / causal anchor | Primary visible cause | HIGH/ULTRA realization | MEDIUM/LOW/POTATO and post-off truth | Reduced-motion / reduced-flash | Clear condition |
| --- | --- | --- | --- | --- | --- |
| `vfx.comply.fire-drain` / `fire-commit` | fire transaction and material-response scalar | unified grade follows physical extinguish and 0.66 reality effects | fire mesh/emissive changes plus the same material-effect scalar; no composer needed | no flash or camera effect | settled step one or beat reconstruction |
| `vfx.comply.organics-drain` / `organics-commit` | surrender/absence transaction and 0.40 floor | grade/value compression follows six-second material ramp | same terrain/life uniforms; organic floor prevents disappearance | same static frame, no vignette | `regression-floor`; persist until A4 front |
| `vfx.a4.life-front` / `life-front→herd-crest` | committed alive authority, radial reveal, gust, water amplitude and locomoting herd | existing grade/AO/bloom enrich already-visible geometry; no new full-screen pass | canonical vegetation/herd/route silhouettes, water amplitude and palette roles | no forced gaze, density travel or wobble; neutral local dissolve only if a flash is proposed | `a4.handback`, leaving persisted `alive` stage only |
| `vfx.maw.fracture-field` / `repair-begun→committed` | physical pieces and cyan fracture trace | selective bloom ≤ existing stack around threshold; bounded light/material pulse | emissive cyan seam and mesh motion at the same timestamp | no shake/flash; FOV stays 75° under reduced motion | commit/interrupt/beat reset; settled operational seam remains |
| `vfx.dive.medium` / `submersion_changed` | eye submergence and depth | FogExp2 + extinction/haze/refraction/Snell/god rays/particles | FogExp2, geometric underwater dome, waterline and oxygen shapes; rays/particles absent | 75°, no camera sway, wobble, wipe surge or forced look; reduced-flash uses a neutral medium blend | actual eye surfacing, not loot acquisition |
| `vfx.dive.oxygen` / `oxygen_threshold` | authoritative oxygen value | restrained geometric edge pulse; color is secondary | numeric/bar/shape/caption remain | pulse rate may remain without scale/brightness pumping | oxygen safe or open-air exit |
| `vfx.reconstruct.stage-*` / each `ship_repair_stage` | monotonic mesh/silhouette/contact change | AO and selective seam bloom support contact | baked/contact values and topology carry state | no camera cue except player-initiated calibration | exact stage reconstruction; no transient override survives |
| `vfx.launch.atmosphere` / `atmosphere-exit` | physical camera radius and flight phase | existing continuous fog/key/fill/sky blend; depth-masked motion begins only in deep space | same lighting/fog endpoints without composer | no smear; FOV max 72° | altitude returns to surface or settled space owner takes over |
| `vfx.crossing.local-handoff` / `local-handoff` | valid target envelope and destination limb coverage | atmosphere/limb glare may soften the proxy→exact transfer | geometry/value occlusion performs the same transfer; no bloom dependency | no flash, FOV pump or forced gaze | exact world owner committed or lease rejected |
| `vfx.tidegarden.abundance` / first-footfall and scanner | canonical profile plus relationship placement | planet grade, AO, water and pollen enrich depth | wet-terrace/canopy/route proxy silhouettes and semantic material colors remain | decorative movement thins, required route motion remains | normal world ownership; scanner overlay clears on exit |
| `vfx.hearth.shelter` / `shelter-certified→safe-rest` | physical enclosure, eave/opening and core | local warm light, exterior grade, optional rain/pollen response | bounded emissive/core light, value-separated walls/opening, route silhouettes | no forced composition; rain absent is legal | freeplay handback or leaving shelter; no global grade remains |

No painterly/Kuwahara pass is authorized in this batch. No treatment claim may
be repaired with unbuilt DOF, SSR, volumetric fog, caustics or dynamic shadows.
Bloom is never evidence; every meaningful bloom cue must compile with a
prewarmed `emissive_pulse`, `local_light_pulse`, or `material_shift` fallback at
the same anchor.

## Agency, focal hierarchy and handback

### Control windows

- `ch4-audit`: movement/look open between validated NPC marks. The directive
  uses bars, not a forced look. Accessible Attend can satisfy required evidence.
- `ch4-comply`, `ch4-defy`: open player first person. The two mandatory
  compliance acts and the refusal remain visibly player-performed.
- `a4-exhale`: Story may hold feet through the stillness/front, then releases
  during W-7744's flight. Manual look guidance is bounded and reversible;
  reduced motion has none.
- `ch5-maw`: free discovery; only the player-initiated repair ritual narrows FOV
  and suggests gaze. Control returns before a test target exists.
- `ch6-dive`: full player camera and 3D swim throughout.
- `ch7-reconstruct`: full camera through all work and the first real hover. The
  sole exterior view follows the explicit calibration action.
- `ch7-board`: player begins the transfer; ownership changes only under physical
  hatch occlusion and after validation.
- `ch8-launch`, `ch8-crossing`, `ch8-landfall`: cockpit/player vehicle authority
  throughout; automation, if used, drives the same controller and never becomes
  a separate camera owner.
- `ch9-settle`: player camera for scan, route, landing-site choice, gathering,
  placement and building. Construction never invokes cinema.
- `ch9-hearth`: player camera; optional rest view only by explicit initiation and
  from actual geometry.

### Forced-attention budget

- No forced attention in audit, compliance, defiance, dive, launch, crossing,
  landing, settlement or manual observations.
- A4 manual gaze suggestion: three soft envelopes, each ≤4 s, peak weights
  `.42/.32/.25`; player input always continues. Reduced motion sets all to zero.
- Maw ritual: ≤8 s after explicit initiation, manual peak weight `.55`, no eye
  relocation, cancel restores 75°.
- Final calibration: 7–9 s, explicit player initiation, one exterior pose,
  entered/exited under ≥90% physical occlusion. This is the only authored camera
  leaving the body.
- Board/egress transfers: only while the hatch physically covers ≥90% of the
  viewport; an interruption returns to the previous validated owner.
- Hearth rest view: optional, ≤8.4 s including lens in/out, max look weight .35;
  any player look input cancels to handback.

### Focal law

Every segment has one first read. Required secondary evidence must be reachable
by player turn, sequential blocking, or an accessible Attend path; it may not
depend on a wide desktop two-shot. Offscreen directional indicators point along
the surface tangent, include a distinct censored/unknown form where appropriate,
and disappear once the subject enters view. They do not pitch the camera toward
the ground on another cube face. No marker, bloom, score hit, caption or grade may
compete with oxygen, landing clearance, a held transaction, or the exact `no.`

### Handback invariant

At every on-foot exit: `cinematicLook.weight=0`, target and semantic gaze intent
cleared, `cinematicCameraPose.weight=0`, FOV exactly 75°, player look/forward/up
unchanged, authored bars/grade/bloom/outline/density overrides cleared, and the
story rail either reset or explicitly transferred. At every vehicle exit:
feedback returns to the state-derived 70° baseline, motion zero when thrust is
zero, and only the vehicle owns pose. Boarding/egress is the only boundary where
the invariant transfers instead of clearing.

## Variants and performance contract

### Desktop and mobile

- Desktop flagship capture: 16:9 at native DPR, pointer locked, HIGH and POTATO.
  Additional 21:9 verifies that important subjects do not drift into decorative
  periphery.
- Mobile capture: representative tall and landscape touch viewports. Use
  `S-mobile`; preserve one subject at a time; scale cockpit X/Y with the existing
  FOV-aware rig; keep hatch coverage sufficient for ownership transfer; place
  captions above touch zones; never make drag-look fight a cinematic envelope.
- On portrait/narrow horizontal FOV, A4 pond and ridge are sequential beats, not
  a failed two-shot. Tidegarden relationship lines and final-window candidates
  are re-ranked for mobile safe area, not achieved by moving world geometry.

### Reduced motion, reduced flash, muted audio and color vision

- Reduced motion holds on-foot FOV at 75°, cockpit at 70–72°, disables authored
  look pulls, traveling calibration boom, underwater camera sway/wobble, FOV
  pumping, flight smear and aggressive transition wipes. A4 becomes a fixed
  player-frame front; calibration becomes one static exterior plate under the
  same physical occlusion; boarding remains a static hatch fill.
- Reduced flash substitutes a neutral local material dissolve for white/glitch
  punctuation. The two-frame W-7744 bare-blink is never reused as required
  evidence.
- Muted audio retains motion, line/shape indicators, captions, material state,
  oxygen geometry, route proxy, shelter value and all player verbs.
- Color-vision/high-contrast modes distinguish regulation, repair, oxygen,
  scanner relationships and habitat power by topology, line cadence, icon,
  luminance and motion. Coral/cyan opposition is decorative unless the shapes
  also differ.

### Lowest-quality semantic parity

POTATO currently zeroes every grass/tree/flora/fauna density and therefore
cannot ship this treatment unchanged. Add a canonical story ecology floor that
is independent of decorative density:

- A4: cheap instanced blade/canopy silhouettes, one herd silhouette group, one
  route-motion proxy and physical pond amplitude.
- Tidegarden: at least one cheap canopy mass, groundcover band, water boundary,
  relationship line/marker, and fauna/pollen route proxy within each authored
  composition/site envelope.
- Reconstruction: monotonic silhouette and emissive/material topology; no AO or
  bloom requirement.
- Dive: FogExp2, geometric aperture/waterline, amber Keel material and oxygen
  shape/numeric cues.
- Space: physical bodies, atmosphere/limb transition, cockpit and pose
  continuity; no post flight smear needed.

This floor is story evidence and must not be removed by a graphics slider. It
may use fewer meshes, lower LOD and static motion, but may not turn Tidegarden
into an empty cyan plain.

### Frame, shader, draw and memory budgets

- Governing target: 60 fps; hard floor 30 fps; no critical frame above 33.4 ms
  on the supported target used for approval.
- Authoring rail/camera solve: zero steady-state allocations and ≤0.25 ms CPU
  p95. All interpolation is uniform/pose work, not React state churn.
- No new full-screen pass is permitted for this batch. Story grade/bloom/
  outline/medium/flight cues parameterize or gate the existing stack.
- For every hero anchor, shader programs, instanced capacity, materials and
  render targets are prewarmed. The ±2 s anchor window permits **zero shader
  compilation and zero material/geometry allocation**.
- A4 peak may not exceed the settled `alive` tier's draw/program budget by more
  than five draws and one already-compiled program; life reveal is a uniform
  over preallocated capacity. If the settled alive scene itself misses budget,
  density/LOD is repaired before camera ambition is reduced.
- Maw repair uses existing meshes plus bounded segments and at most one
  non-shadow-casting local light. Ship stages merge static geometry where
  possible and leave no duplicate hidden hulls after commit.
- Tidegarden's canonical Potato ecology floor targets ≤8 additional instanced
  draws over terrain/water/ship and no per-frame route allocations. HIGH
  abundance scales instance count, not React component count.
- The local handoff keeps one prepared destination shell/world cache and drops
  stale preparation after the signed boundary. Capture peak GPU/JS memory and
  require no monotonic growth across origin→sibling→origin→sibling.
- Report p50/p95/p99 CPU and GPU frame time, draw calls, triangles, programs,
  JS heap and GPU memory before/at/after A4 front, Maw commit, waterline,
  calibration, atmosphere exit, local handoff, touchdown, first foundation and
  ecology night. Relative claims without these numbers cannot approve beauty.

## Reset, replay and reconstruction plan

| Boundary | Required behavior |
| --- | --- |
| beat entry / deep link | reconstruct committed physical state first; load exactly one hashed AV rail; sample it from the committed semantic anchor; do not replay arrival, transactions, item pickups or cinematics |
| pause / focus loss | freeze narrative clock, gaze/FOV envelopes, visual punctuation, transaction hold and optional rest view on the same sample; do not let wall clock jump the camera on resume |
| interrupted Maw repair | clear look/FOV/grade/bloom cues, return 75°, preserve unconsumed kit and unrepaired physical state |
| dive failure / reload | reconstruct at declared safe shore boundary with committed Keel inventory preserved and open-air medium; never spawn underwater at low oxygen; do not award return accomplishment without legal surface evidence |
| calibration interruption | if before exterior transfer, remain player-owned; if after occlusion, complete deterministic return through occlusion or reconstruct at 75° outside; never leave a partial pose weight |
| boarding interruption | before transfer, restore validated exterior 75°; after committed transfer, restore sealed cockpit 70°; no half-owned camera/input state |
| local-handoff lease failure | keep current system pose/cockpit/world owner and cancel target visuals cleanly; no proxy/exact double body or origin jump |
| landing failure | remain in vehicle approach with 70° and existing world owner; no surface camera or first-footfall claim |
| structure edit during rest candidate | cancel optional composition to player look, recompute candidates only after committed edit, never move camera or geometry during evaluation |
| beat exit / completion / quit | `SceneAvCueRailRuntime.reset()`, clear cinematic pose/look/target, letterbox, sleep fade and temporary effect owners; restore state-derived 75° on foot or 70° in cockpit |
| sandbox no-op | no active Story rail means exact `{}` samples; world/player/vehicle render paths match the shipped sandbox byte-for-byte except separately signed canonical Tidegarden content |

## Alternate flagship thesis — Direction B: The Uninterrupted Witness

Direction B is structurally distinct, not a reduced-motion fallback. It removes
all authored on-foot FOV changes and look pulls. The player camera remains 75°
from arrival through building; the cockpit remains 70° except existing
controller-derived feedback. Cinema is produced by **worlds crossing the frame
the player already chose**, not by the frame seeking subjects.

- Audit is blocked as environmental theatre: W-7744 waits/moves into validated
  player-relative zones only after the player approaches each mark. The
  directive has no bars.
- Compliance and refusal retain a constant lens. The drain, intact tree and
  quiet after `no.` do all formal work.
- A4 becomes a 360° concentric event with repeated but non-duplicative disclosure:
  the front crosses the player's local ground in every direction, the pond and
  ridge each emit visible secondary responses, and an offscreen surface-tangent
  icon reports W-7744/pack causality. No gaze target exists.
- Maw repair is staged into the player's held foreground—segments rise into
  view from the physical cradle—at 75°, with no ritual zoom.
- The dive stays 75°; medium and body clock create the perceptual change.
- Reconstruction remains all first person except the contractually unique final
  calibration. That reveal is one **static** low 52° witness plate entered and
  exited behind the canopy, not a traveling boom.
- Launch, crossing and landing stay at a visually quieter 70° cockpit baseline;
  speed is perceived through body parallax, planet growth and cockpit response,
  not FOV pumping or smear.
- Tidegarden abundance is staged as three depth bands and intersecting route
  motion around the player's free view. Scanner relationships select one layer
  by suppression, never by recentering.
- The hearth has no authored window lens. Safe rest returns to the player's
  exact current frame; if origin is visible, it is because the player built and
  looked there. If not, the real threshold/core/ship composition carries the
  relation.

Direction B is more austere and more agency-pure. Its risk is that procedural
blocking and offscreen equivalents must be exceptional to keep A4, the Maw
ritual and abundance from reading flat. Direction A should be preferred only if
a blind headed A/B of A4, calibration and the free-layout hearth finds its soft
guidance emotionally stronger **without** reporting stolen control. Otherwise
Direction B is the more coherent flagship language.

## Capture and review specification

### Exact anchor frames

For every ordered anchor in `story-intent.md`, capture frame `-1`, the first
authoritative frame, and frame `+1`, with a telemetry sidecar containing beat,
anchor/event ID, camera owner, FOV, pose source, reality stage/effects, AV rail
revision and active cue IDs, quality tier, reduced-motion/flash state, viewport,
world/profile hash, draw calls, programs and frame time. Capture optional anchors
only when performed and label absence as optional, never failed.

Hero contact sheets must include at minimum:

- `anc.audit.arrival-handback`, every mismatch mark, and `directive`;
- both compliance commits plus `regression-floor`;
- `tool-refusal`, `no-committed`, every A4 front disclosure, `pack-torn`, and
  `a4.handback`;
- pack/kit, repair begin/commit/direction handback, and pond resonance;
- both sides of waterline, oxygen-authored, Keel reveal/free, surface and dry bank;
- diagnosis, every ship stage, first legal hover, calibration entry/peak/occluded
  handback;
- hatch enter/transfer/seal/cockpit handback;
- ignition/liftoff/atmosphere exit, optional lookback, target, handoff and
  approach;
- touchdown/egress/first footfall/on-foot handback;
- scanner overload/one relationship/each viable site grammar/foundation/core/
  shelter certification;
- ecology night/safe rest, at least three valid habitat layouts (origin window,
  non-origin doorway, compact sealed), optional composition where legal, and
  free-play handback.

### Dense transition strips

- 60 fps video plus exact-frame dump from 1 s before to 3 s after the arrival
  handback and each compliance transaction.
- Continuous A4 capture from `no-committed -2 s` through `a4.handback +3 s`, with
  additional every-frame dumps around first life visibility, pond response,
  herd first silhouette and pack collision.
- Repair from `repair-begun -2 s` through `direction-handback +3 s`.
- Waterline in/out ±3 s and oxygen threshold ±2 s; continuous Keel-to-shore run.
- Each ship-stage commit ±2 s; full 12 s calibration including both occlusions.
- Boarding/egress from hatch interaction -2 s through handback +3 s.
- Continuous ignition through atmosphere exit; local handoff ±5 s with both
  system pose and render-origin telemetry; touchdown through first footfall.
- Foundation/core/shelter commits ±3 s; full ecology-night/rest/optional-window/
  handback flow.

### Variant matrix

Run all pillar captures on HIGH desktop manual, HIGH movie, POTATO manual,
reduced motion + reduced flash, muted audio, and mobile touch. Run color-vision/
high-contrast checks for compliance, oxygen, scanner and Tidegarden. Run
origin→sibling→origin→sibling continuously and compare palette, camera ownership,
world/profile hash, memory and handback on both returns. Rescue-assisted runs are
watermarked and cannot enter the acceptance evidence set.

### Headed real-GPU taste questions

1. Does the exact arrival→audit boundary feel like one breath, with no lens,
   exposure, pointer-lock or reality-stage pop?
2. Can a naive viewer identify W-7744's perceptual gap, both compliance losses,
   the harmless tool refusal and the causal pack tear without author notes,
   audio, bloom or color?
3. Does A4 feel like life becoming perceptible rather than assets spawning, and
   does the player report guidance rather than camera theft?
4. Is the waterline continuous and comfortable; is the Keel always legible; does
   surfacing—not pickup—feel like release?
5. Does every repair stage change silhouette, weight and use while the same scar
   survives? Does the sole exterior reveal earn its exception?
6. Are boarding, local handoff and egress perceived as physical continuities,
   with no blink, hidden teleport, parent-frame snap or A5 warp language?
7. Does Tidegarden read in under two seconds as abundant, alien-verdant and
   non-volcanic while the origin remains beautiful rather than obsolete?
8. On Potato, is the planet still visibly alive and relational rather than empty?
9. Can three radically different valid shelters each produce a truthful rest
   composition, including one with no origin-facing window?
10. Across a full run, are there any hitches, shader pops, stale bars, leaked
    grades, FOV residue, doubled camera writers or memory growth at the exact
    emotional turns?

## Risks and cross-note requests

1. **Authority mismatch, high:** baseline stage/FOV metadata conflicts with story
   intent and current handback code. Resolve with an exact headed telemetry
   capture before scene implementation; do not alter the shipped arrival.
2. **Cue ownership, high:** `SceneAvCueRail` is not yet visibly wired to the live
   camera/post stack. One integrator must own the rail and prove overlapping FOV
   writers are impossible across Story, player medium and vehicle boundaries.
3. **Potato ecology, blocking for A4/Tidegarden:** current quality settings remove
   all life. The canonical story-proxy floor is required before either scene can
   claim semantic parity.
4. **Reduced motion, high:** current underwater camera sway appears unconditional.
   It must be gated together with wobble, FOV expansion and authored gaze.
5. **Procedural composition, high:** W-7744 routes, dry pack, landing pads,
   first-footfall, ecology relationships and hearth candidates all depend on
   shared spawn/path/structure validation. Cinema may not repair an invalid pose
   with a camera angle.
6. **A4 performance, high:** life fields and herd capacity must be prewarmed and
   revealed by uniform/locomotion; any allocation or compile hitch at the front
   vetoes the candidate.
7. **Local handoff, high:** the destination-limb concealment works only if proxy,
   exact shell, pose, star direction and profile hash agree. A glare mask cannot
   excuse a spatial discontinuity.
8. **Free-layout final image, medium:** some valid shelters will not frame the
   origin. The alternate threshold composition is a first-class result, not a
   fallback failure.
9. **Score cross-note request after independence:** align audiovisual punctuation
   only through the shared semantic anchors—especially compliance commits,
   `a4.life-front`, `pond-wakes`, `herd-crest`, `maw.repair-committed`, legal
   surfacing, ship-stage commits, atmosphere exit, local handoff, shelter
   certification and safe rest. Cinematography makes no assumption here about
   the Score Director's harmony, motif or timing proposal.

## Cinematography Director disposition

`ready_for_cross_notes` — Direction A provides a complete 13-beat camera,
palette, lighting, post-FX, fallback, agency, free-layout, reset, performance and
evidence contract grounded in the shipped cut and current runtime. Direction B
is a genuinely different constant-lens/world-blocking alternative. The treatment
is ready for independent Score cross-notes and Cohesion review; the authority
mismatch, live cue ownership, Potato ecology floor, reduced-motion underwater
gate, A4 prewarm, and local-handoff continuity remain explicit contract risks and
must be closed before runtime or visual approval.
