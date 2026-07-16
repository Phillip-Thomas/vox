import fs from 'node:fs'
import path from 'node:path'

const run = path.dirname(new URL(import.meta.url).pathname)
const read = (name) => fs.readFileSync(path.join(run, name), 'utf8')
const readJson = (name) => JSON.parse(read(name))
const readJsonl = (name) => read(name).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
const existingContract = fs.existsSync(path.join(run, 'scene-contract.json')) ? readJson('scene-contract.json') : null

const directors = ['chapter', 'score', 'cinematography']
const peerFile = (director) => `${director}-peer-notes.jsonl`
const reconciliationFile = (director) => `${director}-reconciliation.jsonl`

const firstWave = directors.flatMap((director) => readJsonl(peerFile(director)))
const reconciliations = new Map(
  directors.flatMap((director) => readJsonl(reconciliationFile(director))).map((entry) => [entry.noteId, entry]),
)
const compiledNotes = firstWave.map((note) => {
  const reconciliation = reconciliations.get(note.id)
  if (!reconciliation) throw new Error(`Missing reconciliation for ${note.id}`)
  return {
    ...note,
    status: reconciliation.status,
    response: reconciliation.response,
    disposition: reconciliation.disposition,
    updatedAt: reconciliation.respondedAt,
  }
})
fs.writeFileSync(path.join(run, 'director-notes.jsonl'), `${compiledNotes.map((note) => JSON.stringify(note)).join('\n')}\n`)

const lock = readJson('production-lock.json')
const shippedVisualBaseline = readJson('shipped-visual-baseline.json')
const arrivalCameraMetadata = shippedVisualBaseline.cameraStates.find((state) => state.anchor === 'anc.audit.arrival-handback')
if (!Number.isFinite(arrivalCameraMetadata?.fovDeg)) throw new Error('Shipped arrival baseline must carry a finite schema FOV mirror')
const arrivalSchemaFovMirror = arrivalCameraMetadata.fovDeg
const tidegardenIdentity = Object.freeze({
  worldId: '-1,-1:p1',
  seed: 1600321158,
  profileId: 'story:tidegarden',
  profileVersion: 1,
  profileRef: 'story:tidegarden@1',
  profileHash: 'pf1-eeef3b78',
  archetype: 'verdant',
})
const tidegardenIdentityText = `worldId ${tidegardenIdentity.worldId}, seed ${tidegardenIdentity.seed}, profileId ${tidegardenIdentity.profileId}, profileVersion ${tidegardenIdentity.profileVersion} (${tidegardenIdentity.profileRef}), profileHash ${tidegardenIdentity.profileHash}, archetype ${tidegardenIdentity.archetype}`
const beats = [...lock.lockedBeats]
const anchorsByBeat = {
  'ch4-audit': ['anc.audit.arrival-handback', 'anc.audit.fire-check', 'anc.audit.life-as-noise', 'anc.audit.tree-distance', 'anc.audit.directive'],
  'ch4-comply': ['anc.comply.fire-order', 'anc.comply.fire-commit', 'anc.comply.organics-order', 'anc.comply.organics-commit', 'anc.comply.regression-floor'],
  'ch4-defy': ['anc.defy.tree-order', 'anc.defy.tool-refusal', 'anc.defy.refuse-available', 'anc.defy.no-committed'],
  'a4-exhale': ['anc.a4.held-stillness', 'anc.a4.life-front', 'anc.a4.pond-wakes', 'anc.a4.herd-crest', 'anc.a4.w7744-flight', 'anc.a4.pack-torn', 'anc.a4.handback'],
  'ch5-maw': ['anc.maw.pack-attended', 'anc.maw.kit-acquired', 'anc.maw.repair-begun', 'anc.maw.repair-committed', 'anc.maw.direction-handback', 'anc.maw.pond-resonance'],
  'ch6-dive': ['anc.dive.waterline', 'anc.dive.oxygen-authored', 'anc.dive.keel-revealed', 'anc.dive.keel-freed', 'anc.dive.surface', 'anc.dive.shore-bank'],
  'ch7-reconstruct': ['anc.reconstruct.diagnosis', 'anc.reconstruct.bench-online', 'anc.reconstruct.frame-restored', 'anc.reconstruct.hull-sealed', 'anc.reconstruct.lift-online', 'anc.reconstruct.first-hover', 'anc.reconstruct.route-online', 'anc.reconstruct.calibration'],
  'ch7-board': ['anc.board.hatch-enter', 'anc.board.camera-transfer', 'anc.board.pressure-seal', 'anc.board.cockpit-handback'],
  'ch8-launch': ['anc.launch.ignition', 'anc.launch.liftoff', 'anc.launch.atmosphere-exit'],
  'ch8-crossing': ['anc.crossing.origin-lookback', 'anc.crossing.sibling-targeted', 'anc.crossing.local-handoff', 'anc.crossing.approach'],
  'ch8-landfall': ['anc.landfall.touchdown', 'anc.landfall.egress', 'anc.landfall.first-footfall', 'anc.landfall.handback'],
  'ch9-settle': ['anc.settle.scanner-overload', 'anc.settle.relationship-attended', 'anc.settle.site-chosen', 'anc.settle.first-foundation', 'anc.settle.core-online', 'anc.settle.shelter-certified'],
  'ch9-hearth': ['anc.hearth.ecology-night', 'anc.hearth.safe-rest', 'anc.hearth.window', 'anc.hearth.freeplay-handback'],
}
const allAnchors = beats.flatMap((beat) => anchorsByBeat[beat])
const anchorBeat = new Map(beats.flatMap((beat) => anchorsByBeat[beat].map((anchor) => [anchor, beat])))

const cueByBeat = {
  'ch4-audit': { id: 'sc.audit.incomplete-model', phrase: 'Inherit the arrival bar, then remove one arranged layer after each committed mismatch until the unresolved square-fifth directive remains.', bar: 'Arrival phrase continues without a restart; mismatch removals occur only after their authoritative events.', mix: 'Dialogue and physical world lead; square fifth and pad remain beneath evidence.', silence: 'No score response occurs before a mismatch commits, and rescue advancement receives no accepting tail.' },
  'ch4-comply': { id: 'sc.comply.self-diminish', phrase: 'At 56 bpm, fire removes warmth and lead, organics remove width and ostinato, and the root-fifth floor remains unresolved.', bar: 'Each atomic transaction starts its local subtraction phrase exactly once.', mix: 'Interaction and physical loss lead; the score makes diminishment audible without masking the command.', silence: 'Empty-organics absence uses the same subtraction and no passive substitute earns punctuation.' },
  'ch4-defy': { id: 'sc.defy.lowercase', phrase: 'A sparse issued pulse stops after the committed lowercase refusal; hold 1.75 seconds of near-silence with no heroic hit.', bar: 'No bar boundary may delay or advance the refusal consequence.', mix: 'The exact line and world remain above a low score floor.', silence: 'The committed word owns the silence; timeout and bypass never advance music.' },
  'a4-exhale': { id: 'sc.a4.breath-front', phrase: 'Refusal establishes T0; alive authority and the first physical life sample commit at immutable T0 plus 1750 ms. Optional bloom or pitched punctuation may acknowledge only an already-visible world and cannot move that front.', bar: 'Musical phase may align after the fixed physical front, but next-bar quantization has no story-time authority.', mix: 'World life, movement, and W-7744 physical evidence remain above the bounded Dorian and quartal bloom.', silence: 'Muted or unavailable audio omits punctuation while geometry and material truth still occur at the fixed front.' },
  'ch5-maw': { id: 'sc.maw.direction', phrase: 'Three broken starts resolve into a sparse repaired triangle voice, followed by a two-second purpose gap before pond resonance.', bar: 'Repair commit may schedule a musical revoice only after the physical seam and beam exist.', mix: 'Repair SFX and hand trace lead; revoice and bed remain subordinate.', silence: 'Pack and kit receive no pickup hit; interrupted repair consumes and sounds nothing.' },
  'ch6-dive': { id: 'sc.dive.two-clocks', phrase: 'World harmony stretches while a non-grid oxygen pulse contracts; surfacing restores ambience, harmony, then width before the dry bank.', bar: 'The physiological oxygen clock never quantizes to musical bars.', mix: 'Breath, oxygen, water, and interaction remain above low-passed score.', silence: 'The Keel pickup gets no completion sting; only a legal surface opens the release.' },
  'ch7-reconstruct': { id: 'sc.reconstruct.one-instrument', phrase: 'Each monotonic repair stage starts and retains one instrumental layer; calibration reveals the assembled relation but ends suspended.', bar: 'Stage phrases begin only on committed repair events and never replay on reconstruction.', mix: 'Construction impacts and engine evidence lead; retained score layers never mask prompts.', silence: 'First hover and route readiness get no trophy sting.' },
  'ch7-board': { id: 'sc.board.one-owner', phrase: 'The route phrase narrows through the hatch; the committed pressure seal owns a 40 ms down, 100 ms zero, and 120 ms recovery envelope.', bar: 'Acoustic ownership follows the physical seal rather than an unrelated scene timer.', mix: 'Hatch and pressure SFX lead; cockpit hum then finds the current root.', silence: 'The only true silence in scope occurs on a valid pressure-seal event.' },
  'ch8-launch': { id: 'sc.launch.ground-relents', phrase: 'Repaired layers synchronize under physical thrust; legal atmosphere exit earns one unresolved bar and a restrained yield.', bar: 'Only the authoritative origin-atmosphere-exited event starts the release.', mix: 'Warnings and engine lead, score follows, surface world recedes naturally.', silence: 'Crash or recovery cannot trigger the atmosphere-exit release.' },
  'ch8-crossing': { id: 'sc.crossing.distance', phrase: `Origin bed remains available behind; only legal targeting with the complete canonical bundle (${tidegardenIdentityText}) arms the Tidegarden motif, palette, world preparation, route, and local handoff. Every consumer receives that same bundle.`, bar: `Coordinate-only and seed-only destination derivation are forbidden. Any change to ${tidegardenIdentity.profileRef} or ${tidegardenIdentity.profileHash} requires contract regeneration plus new exact-anchor score, camera, cache, world, and headed evidence before signoff.`, mix: 'Cockpit and engine lead over a quiet bed and a destination fragment below warnings.', silence: 'Optional lookback changes no cue eligibility, the destination motif stays silent before the complete identity bundle commits, and no warp signal is introduced.' },
  'ch8-landfall': { id: 'sc.landfall.world-first', phrase: 'The destination key already exists; touchdown has no reward sting and first footfall holds a brief world-first hush before the bed returns.', bar: 'Landing cues follow validated touchdown, egress, and footfall only.', mix: 'Landing, egress, and ecology remain above the destination bed.', silence: 'Failed landing keeps approach state and earns no arrival punctuation.' },
  'ch9-settle': { id: 'sc.settle.abundance-choice', phrase: 'Scanner density thins under attended relationship; foundation and core add bounded tones without scoring site morality or build percentage.', bar: 'Committed placements may add one local tone; rejected placement spends none.', mix: 'Scanner, relationship, world, and placement SFX lead over bounded notes.', silence: 'Optional observation records never cue progression and building never moves the camera.' },
  'ch9-hearth': { id: 'sc.hearth.between-fires', phrase: 'Night ecology and safe rest permit two phrases of relational counterpoint that ebb without cadence into ordinary free play.', bar: 'The second phrase releases story ownership without resolving the protected larger question.', mix: 'Interior, rest, and living-world sound lead over low counterpoint.', silence: 'Interrupted rest earns no duet; the optional opening changes no cue eligibility.' },
}

const revealForBeat = {
  'ch4-audit': 'rev-w7744-limited-world',
  'ch4-comply': 'rev-compliance-self-diminishes',
  'ch4-defy': 'rev-will-is-an-act',
  'a4-exhale': 'rev-a4-alive',
  'ch5-maw': 'rev-purpose-after-power',
  'ch6-dive': 'rev-body-counts',
  'ch7-reconstruct': 'rev-repair-reinterprets',
  'ch7-board': 'rev-repair-reinterprets',
  'ch8-launch': 'rev-distance-enlarges-relation',
  'ch8-crossing': 'rev-distance-enlarges-relation',
  'ch8-landfall': 'rev-abundance-is-choice',
  'ch9-settle': 'rev-abundance-is-choice',
  'ch9-hearth': 'rev-home-between-worlds',
}
const actionForBeat = {
  'ch4-audit': 'Follow the grounded inspection and attend fire, living clutter, and the impossible tree before the directive.',
  'ch4-comply': 'Personally douse the persisted fire and resolve the organics order through atomic world transactions.',
  'ch4-defy': 'Approach the protected tree, test the harmless tool refusal, and invoke lowercase refuse before committing no.',
  'a4-exhale': 'Witness the earned material-to-alive front without being assigned a false choice.',
  'ch5-maw': 'Find the torn pack, acquire the unique kit, and complete the cancel-safe repair ritual before choosing any first use.',
  'ch6-dive': 'Enter water, remain meaningfully submerged, free the Keel Memory, surface legally, and bank it on dry shore.',
  'ch7-reconstruct': 'Diagnose and rebuild the same scarred wreck through bench, frame, hull, lift, hover, route, and calibration stages.',
  'ch7-board': 'Enter through the physical hatch and complete one occluded transfer from on-foot to cockpit authority.',
  'ch8-launch': 'Ignite, lift, steer, and cross the origin atmosphere with the real vehicle controller.',
  'ch8-crossing': 'Target canonical Tidegarden and physically cross local space; looking back remains optional.',
  'ch8-landfall': 'Choose a dry approach, touch down, egress through the hatch, and take the first player-owned step.',
  'ch9-settle': 'Attend one ecological relationship, choose any valid site, place local structure, power a core, and certify physical shelter.',
  'ch9-hearth': 'Live through local night, rest safely in the built shelter, and return to free play in the same authored layout.',
}

const eventSignalByAnchor = {
  'anc.audit.arrival-handback': 'arrival_handback_authenticated',
  'anc.audit.fire-check': 'ev.audit.fire-mismatch',
  'anc.audit.life-as-noise': 'ev.audit.life-mismatch',
  'anc.audit.tree-distance': 'ev.audit.tree-mismatch',
  'anc.audit.directive': 'ev.audit.sterilization-authorized',
  'anc.comply.fire-order': 'ev.comply.fire-order-issued',
  'anc.comply.fire-commit': 'ev.comply.fire-doused',
  'anc.comply.organics-order': 'ev.comply.organics-order-issued',
  'anc.comply.organics-commit': 'ev.comply.organics-resolved',
  'anc.comply.regression-floor': 'ev.comply.regression-settled',
  'anc.defy.tree-order': 'ev.defy.tree-order-issued',
  'anc.defy.tool-refusal': 'ev.defy.tree-target-protected',
  'anc.defy.refuse-available': 'ev.defy.refuse-command-available',
  'anc.defy.no-committed': 'ev.defy.refusal-committed',
  'anc.a4.held-stillness': 'ev.a4.refusal-hush-held',
  'anc.a4.life-front': 'ev.a4.alive-authority-committed',
  'anc.a4.pond-wakes': 'ev.a4.pond-response-visible',
  'anc.a4.herd-crest': 'ev.a4.herd-route-visible',
  'anc.a4.w7744-flight': 'ev.a4.w7744-fault-recorded',
  'anc.a4.pack-torn': 'ev.a4.field-pack-dropped',
  'anc.a4.handback': 'ev.a4.on-foot-authority-restored',
  'anc.maw.pack-attended': 'ev.maw.pack-attended',
  'anc.maw.kit-acquired': 'ev.maw.kit-acquired',
  'anc.maw.repair-begun': 'ev.maw.repair-begun',
  'anc.maw.repair-committed': 'maw_repaired',
  'anc.maw.direction-handback': 'ev.maw.first-direction-resolved',
  'anc.maw.pond-resonance': 'ev.maw.keel-resonance-detected',
  'anc.dive.waterline': 'submersion_changed',
  'anc.dive.oxygen-authored': 'oxygen_threshold',
  'anc.dive.keel-revealed': 'ev.dive.keel-revealed',
  'anc.dive.keel-freed': 'keel_memory_acquired',
  'anc.dive.surface': 'dive_surfaced',
  'anc.dive.shore-bank': 'ev.dive.keel-banked',
  'anc.reconstruct.diagnosis': 'ev.reconstruct.relationships-diagnosed',
  'anc.reconstruct.bench-online': 'ship_repair_stage:bench_online',
  'anc.reconstruct.frame-restored': 'ship_repair_stage:frame_restored',
  'anc.reconstruct.hull-sealed': 'ship_repair_stage:hull_sealed',
  'anc.reconstruct.lift-online': 'ship_repair_stage:lift_online',
  'anc.reconstruct.first-hover': 'ev.reconstruct.first-legal-hover',
  'anc.reconstruct.route-online': 'ev.reconstruct.flight-ready',
  'anc.reconstruct.calibration': 'ev.reconstruct.calibration-completed',
  'anc.board.hatch-enter': 'ev.board.hatch-entered',
  'anc.board.camera-transfer': 'ev.board.camera-owner-vehicle',
  'anc.board.pressure-seal': 'ev.board.cockpit-sealed',
  'anc.board.cockpit-handback': 'ship_boarded',
  'anc.launch.ignition': 'ship_launched',
  'anc.launch.liftoff': 'ev.launch.legal-liftoff',
  'anc.launch.atmosphere-exit': 'ev.launch.origin-atmosphere-exited',
  'anc.crossing.origin-lookback': 'ev.crossing.origin-attended:optional',
  'anc.crossing.sibling-targeted': `system_body_targeted:{${tidegardenIdentityText}}`,
  'anc.crossing.local-handoff': 'ev.crossing.world-owner-transferred',
  'anc.crossing.approach': 'ev.crossing.approach-established',
  'anc.landfall.touchdown': 'planet_arrived',
  'anc.landfall.egress': 'ev.landfall.egress-cleared',
  'anc.landfall.first-footfall': 'ev.landfall.first-footfall',
  'anc.landfall.handback': 'ev.landfall.on-foot-authority-restored',
  'anc.settle.scanner-overload': 'ev.settle.scanner-overload',
  'anc.settle.relationship-attended': 'ecology_relationship_attended',
  'anc.settle.site-chosen': 'ev.settle.site-validated',
  'anc.settle.first-foundation': 'ev.settle.foundation-placed',
  'anc.settle.core-online': 'station_activated',
  'anc.settle.shelter-certified': 'shelter_certified',
  'anc.hearth.ecology-night': 'ev.hearth.night-lived',
  'anc.hearth.safe-rest': 'ev.hearth.safe-rest-completed',
  'anc.hearth.window': 'ev.hearth.origin-framed:optional',
  'anc.hearth.freeplay-handback': 'ev.hearth.two-world-story-handoff',
}

const treatment = read('cinematography-treatment.md')
let currentBeat = null
const parsedShots = []
for (const line of treatment.split(/\r?\n/)) {
  const heading = line.match(/^### `([^`]+)`/)
  if (heading && beats.includes(heading[1])) currentBeat = heading[1]
  const match = line.match(/^\| `((?:cin)\.[^`]+)` \| (.+)$/)
  if (!match || !currentBeat) continue
  const columns = `| ${match[2]}`.split('|').slice(1, -1).map((value) => value.trim())
  const [anchorCell, focalCell, authorityCell, lensCell, motionCell, transitionCell] = columns
  const anchorMatches = [...anchorCell.matchAll(/anc\.[a-z0-9.-]+/g)].map((entry) => entry[0])
  if (anchorMatches.length === 0) throw new Error(`Shot ${match[1]} has no semantic anchor`)
  const clean = (value) => value.replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim()
  parsedShots.push({
    id: match[1],
    beat: currentBeat,
    startAnchorRef: anchorMatches[0],
    endAnchorRef: anchorMatches.at(-1),
    focalCell: clean(focalCell),
    authorityCell: clean(authorityCell),
    lensCell: clean(lensCell),
    motionCell: clean(motionCell),
    transitionCell: clean(transitionCell),
  })
}
if (parsedShots.length !== 64) throw new Error(`Expected 64 treatment shots, found ${parsedShots.length}`)
for (const shot of parsedShots) {
  if (!allAnchors.includes(shot.startAnchorRef) || !allAnchors.includes(shot.endAnchorRef)) {
    throw new Error(`Shot ${shot.id} has unresolved anchor range ${shot.startAnchorRef} -> ${shot.endAnchorRef}`)
  }
}

const windowId = (beat) => `ag.${beat.replace(/^ch/, 'ch').replaceAll('-', '.')}`
const windowControls = (beat) => {
  if (beat === 'a4-exhale') return { movement: 'blended', look: 'blended', interaction: 'disabled' }
  if (beat === 'ch7-board' || beat === 'ch8-landfall') return { movement: 'blended', look: 'blended', interaction: 'player' }
  return { movement: 'player', look: 'player', interaction: 'player' }
}
const agencyType = {
  'ch4-audit': 'observation', 'ch4-comply': 'authored-rite', 'ch4-defy': 'authored-rite', 'a4-exhale': 'observation',
  'ch5-maw': 'authored-rite', 'ch6-dive': 'mandatory-action', 'ch7-reconstruct': 'mandatory-action', 'ch7-board': 'mandatory-action',
  'ch8-launch': 'mandatory-action', 'ch8-crossing': 'mandatory-action', 'ch8-landfall': 'mandatory-action', 'ch9-settle': 'choice', 'ch9-hearth': 'choice',
}
const agencyWindows = beats.map((beat) => ({
  id: windowId(beat),
  startAnchorRef: anchorsByBeat[beat][0],
  endAnchorRef: anchorsByBeat[beat].at(-1),
  ...windowControls(beat),
  agencyType: agencyType[beat],
  mandatoryPath: actionForBeat[beat],
  fallbackAllowed: ['ch4-audit', 'ch9-settle'].includes(beat),
  fallbackSemantics: ['ch4-audit', 'ch9-settle'].includes(beat)
    ? 'Accessible Attend may replace gaze dwell while preserving the same authored perceptual act; automation alone never proves acceptance.'
    : 'No automatic completion is authorized; reconstruction may restore only already-committed authoritative state.',
  fallbackCountsAsNarrativeAcceptance: false,
  rescueAllowed: true,
  rescueSemantics: 'A technical rescue returns to the latest validated safe boundary, records the rescue, and withholds narrative acceptance and accomplishments.',
  rescueCountsAsNarrativeAcceptance: false,
  motivation: `The player experiences ${revealForBeat[beat]} through a performed or consciously attended act rather than a detached modal.`,
  handBack: beat === 'ch7-board'
    ? 'Transfer exactly once to the sealed cockpit at 70 degrees with no leaked on-foot writer.'
    : beat.startsWith('ch8-')
      ? 'Return the current physical controller at its state-derived vehicle or on-foot FOV with no cinematic writer left active.'
      : 'Restore player-owned on-foot control at exactly 75 degrees with gaze, bars, grade, bloom, and temporary rail owners cleared.',
  pauseBehavior: 'Freeze the pause-aware narrative clock, held transactions, camera envelopes, and optional compositions at one causal sample.',
  focusLossBehavior: 'Freeze as pause; resume from the same committed boundary without wall-clock camera jumps or duplicated events.',
  replayBehavior: 'Reconstruct physical and inventory state from committed semantic events, then sample the rail without replaying one-shot rewards.',
  mobileBehavior: 'Keep one primary subject inside the touch-safe body area; provide the same explicit action and surface-tangent direction language.',
  reducedMotionBehavior: 'Remove forced gaze, traveling poses, sway, smear, and FOV pumping while preserving geometry, timing, state truth, and every required verb.',
}))
agencyWindows.push({
  id: 'ag.hearth.optional-opening',
  startAnchorRef: 'anc.hearth.window',
  endAnchorRef: 'anc.hearth.window',
  movement: 'player',
  look: 'blended',
  interaction: 'player',
  agencyType: 'observation',
  mandatoryPath: 'No story-mandatory path: only explicit player invocation may enter the truthful opening composition, and omitting it leaves every story and score gate unchanged.',
  fallbackAllowed: false,
  fallbackSemantics: 'If no truthful sightline exists, omit the composition or use the treatment-approved real doorway or eave relation; automation may not fabricate or move geometry.',
  fallbackCountsAsNarrativeAcceptance: false,
  rescueAllowed: false,
  rescueSemantics: 'No rescue is needed because this window is optional; interruption returns immediately to the player current valid frame without narrative credit.',
  rescueCountsAsNarrativeAcceptance: false,
  motivation: 'Offer a player-requested relation between the built shelter, Tidegarden life, ship or route, and origin only when the actual chosen geometry supports it.',
  handBack: 'After at most 1200 ms compression, 6000 ms hold, and 1200 ms return, restore exact player-owned 75-degree look; any look input cancels into that return sooner.',
  pauseBehavior: 'Freeze the optional lens and bounded look-weight cycle on its current pause-aware sample.',
  focusLossBehavior: 'Freeze as pause and resume the same sample; never use elapsed wall time to jump into or out of compression.',
  replayBehavior: 'The optional view is never reconstructed as active; reload returns to the real player-owned shelter frame and leaves the observation ungated.',
  mobileBehavior: 'Rank a truthful doorway, eave, ship, or route relation inside the mobile safe area; omission is valid and geometry never moves.',
  reducedMotionBehavior: 'Keep FOV at 75 degrees, apply no look pull, and preserve optional player invocation plus the same real-world relation.',
})

const primaryOf = (focal) => focal.split(/;\s*2\s+/)[0].replace(/^1\s+/, '') || 'The authored physical subject at the semantic anchor'
const secondaryOf = (focal) => {
  const match = focal.match(/;\s*2\s+([^;]+)/)
  return match ? match[1] : 'The continuous world and prior causal state remain visibly subordinate.'
}
const cameraAuthority = (shot) => {
  if (/P\+L|P→O|O→V|V→O→P|O→C→O/.test(shot.authorityCell)) return 'cinematic-look'
  if (/\bV\b/.test(shot.authorityCell)) return 'lens-rig'
  return 'player-camera'
}
const lensNumbers = (cell) => [...cell.matchAll(/(\d+(?:\.\d+)?)°/g)].map((entry) => Number(entry[1]))
const secondsToMs = (cell) => {
  const match = cell.match(/((?:\d+(?:\.\d+)?)|(?:\.\d+))\s*s\b/)
  return match ? Math.round(Number(match[1]) * 1000) : 0
}
const motionMode = (cell) => {
  const text = cell.toLowerCase()
  if (/player|free|normal approach|actual suit|turns and ascends|steers|traverses|lives through/.test(text)) return 'player-owned'
  if (/boom|dolly/.test(text)) return 'dolly'
  if (/orbit/.test(text)) return 'orbit'
  if (/glide|track/.test(text)) return 'track'
  if (/pan|tilt/.test(text)) return 'pan-tilt'
  if (/gaze|suggest|target/.test(text)) return 'look-pull'
  return 'locked'
}
const gradeIntent = (beat, shotId) => {
  if (shotId === 'cin.audit.01-inherited-world') return 'Preserve auth.arrival.handback.effects exactly on the first presented audit frame. Headed telemetry must authenticate camera owner, pose, FOV, reality authority, life fields, grade, exposure, and every temporary effect owner before any numeric camera or effect transition is authored.'
  if (shotId === 'cin.a4.01-held-field') return 'Hold the committed material regression floor with reveal zero through the entire pre-front interval. Alive authority and the first nonzero physical life sample begin only at the exit anchor, immutable T0 plus 1750 ms.'
  if (beat === 'ch4-comply') return 'Follow committed material diminishment to 0.66 then 0.40 while the organic floor remains 0.30; never lead the world transaction.'
  if (beat === 'ch4-defy') return 'Hold the committed regression floor with no heroic saturation, rim light, or refusal flash.'
  if (beat === 'a4-exhale') return 'Enrich only already-visible alive geometry and water response; the grade cannot author the material-to-alive event.'
  if (beat.startsWith('ch8-crossing')) return 'Maintain coherent origin and Tidegarden planet-derived palettes across the physical local handoff.'
  if (beat.startsWith('ch8-landfall') || beat.startsWith('ch9-')) return 'Preserve Tidegarden humid cyan-blue, turquoise, cobalt, ivory, and scarce coral semantic roles without turning abundance into a loot glow.'
  return 'Preserve the current planet-derived material response; exposure and grade follow physical state and never substitute for it.'
}
const postVerb = (beat) => ({
  'ch4-comply': 'parameterize the existing grade after each committed material transaction',
  'a4-exhale': 'support the prewarmed physical life front without creating its story truth',
  'ch5-maw': 'punctuate the visible cyan fracture seam with a bounded existing-stack response',
  'ch6-dive': 'derive the underwater medium and oxygen edge language from eye submersion and authoritative oxygen',
  'ch7-reconstruct': 'support monotonic topology and contact without hiding duplicate hulls',
  'ch7-board': 'follow physical hatch occlusion and exposure ownership transfer',
  'ch8-launch': 'follow physical altitude, atmosphere, and thrust without warp grammar',
  'ch8-crossing': 'soften only the limb-covered local renderer handoff',
  'ch8-landfall': 'enrich already-present wet depth and ecology without a landing reward bloom',
  'ch9-settle': 'keep scanner relationships and bounded habitat light subordinate to physical placement',
  'ch9-hearth': 'separate cool living exterior from bounded warm shelter without a completion glow',
}[beat] ?? null)

const variantRefs = ['variant-desktop', 'variant-mobile', 'variant-reduced-motion', 'quality-high', 'quality-medium', 'quality-low', 'quality-potato']
const shots = parsedShots.map((shot) => {
  const isArrivalBoundary = shot.id === 'cin.audit.01-inherited-world'
  const isA4PreFront = shot.id === 'cin.a4.01-held-field'
  const isDiveEntry = shot.id === 'cin.dive.02-air-stays-above'
  const isOptionalHearthOpening = shot.id === 'cin.hearth.03-opening-between-worlds'
  const isHearthHandback = shot.id === 'cin.hearth.04-the-line-remains-open'
  const isExteriorCalibration = shot.id === 'cin.reconstruct.09-one-exterior-reveal'
  const fovs = isDiveEntry || isOptionalHearthOpening
    ? lensNumbers(shot.lensCell.split(';')[0])
    : lensNumbers(shot.lensCell)
  const startFovDeg = isArrivalBoundary ? arrivalSchemaFovMirror : fovs[0] ?? (shot.beat.startsWith('ch8-') || shot.beat === 'ch7-board' ? 70 : 75)
  const endFovDeg = isArrivalBoundary ? arrivalSchemaFovMirror : fovs.at(-1) ?? startFovDeg
  const effectVerb = isA4PreFront ? null : postVerb(shot.beat)
  const controls = isOptionalHearthOpening
    ? { movement: 'player', look: 'blended', interaction: 'player' }
    : windowControls(shot.beat)
  return {
    id: shot.id,
    beat: shot.beat,
    startAnchorRef: shot.startAnchorRef,
    endAnchorRef: shot.endAnchorRef,
    focalHierarchy: {
      primary: primaryOf(shot.focalCell),
      secondary: secondaryOf(shot.focalCell),
      allowedAmbiguity: 'Protected motives and ontology may remain multiply readable; physical causality, usable routes, oxygen, ownership, and interaction state may not be ambiguous.',
      subjectOccupancyIntent: 'Keep one first read in the body-safe frame; sequence secondary evidence when a narrow viewport cannot hold both honestly.',
      horizonIntent: 'Maintain a natural surface horizon or physically coherent cockpit axis; never pitch toward the ground merely because a target lies on another cube face.',
      negativeSpaceIntent: 'Reserve clear space for movement direction, captions, oxygen, and surface-tangent guidance without decorative competition.',
    },
    cameraAuthority: cameraAuthority(shot),
    framing: {
      scale: shot.id === 'cin.reconstruct.09-one-exterior-reveal' ? 'wide' : 'first-person',
      blocking: shot.focalCell,
      screenDirection: {
        axis: 'The current physical route, surface tangent, or vehicle-forward axis established by the preceding continuous frame.',
        movement: shot.motionCell,
        continuityRule: 'Preserve world position, forward and up vectors, surface support, and prior screen direction; a declared physical occlusion is the only ownership seam.',
      },
      desktopSafeArea: 'Primary subject remains inside the central body-safe field with HUD and prompt clearance at 16:9 and 21:9.',
      mobileSafeArea: 'Show one primary subject at a time inside the touch-safe area; re-rank secondary evidence rather than moving world geometry.',
      exitComposition: shot.transitionCell,
    },
    lens: {
      startFovDeg,
      endFovDeg,
      durationMs: isArrivalBoundary ? 0 : Math.max(secondsToMs(shot.lensCell), secondsToMs(shot.motionCell)),
      easing: isArrivalBoundary
        ? 'No interpolation is authorized: preserve auth.arrival.handback.camera exactly until headed telemetry authenticates its numeric state.'
        : isOptionalHearthOpening
          ? 'Only after player invocation: compress 75 to 52 degrees over 1200 ms, hold no more than 6000 ms, then return 52 to 75 degrees over 1200 ms; player look input begins the return immediately.'
          : /smoothstep/i.test(`${shot.lensCell} ${shot.motionCell}`)
            ? 'symmetric smoothstep from the treatment rail'
            : 'continuous pause-aware treatment easing with no overshoot',
      focusTarget: isArrivalBoundary ? 'auth.arrival.handback.pose, then the player-selected grounded W-7744 route' : primaryOf(shot.focalCell),
      physicalIntent: {
        mappingStatus: 'intent-only',
        character: isArrivalBoundary
          ? 'The equal numeric FOV fields are a schema mirror of shipped-visual-baseline metadata, not implementation authority. Runtime must preserve symbolic auth.arrival.handback.camera owner, pose, forward, up, FOV, and effect vector exactly; headed telemetry must authenticate them before any numeric transition is added.'
          : isOptionalHearthOpening
            ? 'A player-invoked optional 75-to-52-degree compression from actual rest-eye geometry, bounded to 8400 ms including return. Reduced motion stays at 75 degrees; no story, score, observation, or completion gate depends on invocation.'
            : 'Embodied wide-angle continuity; compression is reserved for explicit player-initiated repair, calibration, or rest attention.',
        focalLengthMm: null,
        filmbackWidthMm: null,
        focusDistance: null,
        depthOfFieldIntent: 'No unbuilt depth-of-field dependency; geometry, value, scale, and motion establish hierarchy on every tier.',
        shutterMotionIntent: 'No authored smear; motion remains physically legible and reduced motion removes nonessential camera dynamics.',
      },
      mobileCropRisk: 'Narrow horizontal field can lose secondary context; preserve the primary and present secondary evidence sequentially with surface-tangent guidance.',
    },
    motion: {
      mode: isOptionalHearthOpening ? 'look-pull' : isHearthHandback || isDiveEntry ? 'player-owned' : motionMode(shot.motionCell),
      durationMs: isOptionalHearthOpening ? 8400 : secondsToMs(shot.motionCell),
      easing: isOptionalHearthOpening
        ? 'Player-invoked bounded look weight no greater than 0.35; player input wins and returns continuously to the current look.'
        : isHearthHandback
          ? 'Player-owned continuous handback in place; release any optional composition with no final dolly, directed postcard, or fade.'
          : 'Pause-aware continuous motion with player input dominant and zero residual ownership at handback.',
      target: primaryOf(shot.focalCell),
      rollPolicy: 'No authored roll; vehicle roll comes only from the real controller and preserves cockpit authority.',
      inputBlend: controls.look === 'blended' ? 'Bounded suggestion only; player look input remains live and cancels toward player authority.' : 'Player owns look; guidance uses composition, sound, reciprocal motion, and offscreen direction rather than camera seizure.',
      collisionPlan: 'Camera, player, NPC, ship, and props retain validated collision and support; no terrain, water, hull, or shelter intersection is hidden by the shot.',
      occlusionPlan: isExteriorCalibration
        ? 'Declare the maintenance iris or canopy mullion as the ownership seam: require at least 90 percent physical viewport coverage before leaving or returning to the body camera.'
        : /hatch|occlusion|canopy|iris/i.test(`${shot.focalCell} ${shot.transitionCell}`)
          ? 'Require at least 90 percent physical hatch, canopy, or iris coverage before changing camera owner.'
          : 'Respect world occlusion; use indicators or accessible Attend instead of seeing through geometry.',
    },
    transition: {
      type: isExteriorCalibration ? 'occlusion' : /hatch|occlusion|canopy|iris/i.test(`${shot.focalCell} ${shot.transitionCell}`) ? 'occlusion' : /sleep fade/i.test(shot.transitionCell) ? 'sleep-fade' : 'continuous',
      declaredCut: false,
      reason: isExteriorCalibration ? 'Declared maintenance-iris or canopy-mullion physical occlusion ownership seam into and out of the sole exterior calibration reveal; no generic visible camera blend or cut.' : shot.transitionCell,
      durationMs: isExteriorCalibration ? 350 : secondsToMs(shot.transitionCell),
      easing: 'Continuous pause-aware transition with exact state reconstruction on interruption.',
    },
    paletteRef: 'pal.distance-between-fires',
    effects: {
      realityStage: ['ch4-audit', 'ch4-comply', 'ch4-defy'].includes(shot.beat) || isA4PreFront ? 'material' : 'alive',
      effectCeiling: ['existing-post-stack-only', 'physical-truth-first', 'prewarmed-no-allocation-anchor-window'],
      grade: {
        intent: gradeIntent(shot.beat, shot.id),
        presetRef: null,
        exposureIntent: 'Preserve readable material and silhouette at every tier; exposure follows physical environment and never masks an ownership seam.',
        resetRef: 'reset-grade',
      },
      lighting: {
        intent: isArrivalBoundary ? 'Preserve symbolic auth.arrival.handback.effects and its authenticated world lighting exactly on the first audit frame; no numeric exposure, grade, bloom, density, or lighting correction is licensed before headed telemetry.' : 'Use existing planet profile, world key and fill, bounded non-shadowing practicals, emissive seams, and actual atmosphere as causal light sources.',
        sourceRefs: ['main/src/game/systems/realityRenderSystem.ts', 'main/src/components/effects/PostFX.tsx', 'cinematography-treatment.md#post-fx-lighting-and-render-causality-ledger'],
        atmosphereIntent: 'Fog and atmosphere derive from world, altitude, and eye medium; no full-screen effect creates state or conceals a renderer transfer.',
        resetRef: 'reset-lighting',
      },
      postEffects: effectVerb ? [{
        id: `fx.${shot.id.slice(4)}`,
        effectRef: 'main/src/components/effects/PostFX.tsx',
        verb: effectVerb,
        entryAnchorRef: shot.startAnchorRef,
        exitAnchorRef: shot.endAnchorRef,
        parametersRef: 'cinematography-treatment.md#post-fx-lighting-and-render-causality-ledger',
        reducedMotionBehavior: 'Preserve physical geometry, material, value, icon, caption, and timing while removing forced motion, flash, wobble, and smear.',
        lowTierFallback: 'Use canonical silhouettes, material value, bounded emissive or local light, geometric medium, and route motion; bloom and particles are never evidence.',
        resetRef: 'reset-effects',
      }] : [],
    },
    agency: {
      agencyWindowRefs: [isOptionalHearthOpening ? 'ag.hearth.optional-opening' : windowId(shot.beat)],
      ...controls,
      handBackAnchorRef: shot.endAnchorRef,
      handBackBehavior: isOptionalHearthOpening
        ? 'Optional and player-invoked only: hold 52 degrees no more than 6000 ms, return to exact player-owned 75 degrees over 1200 ms, and cancel immediately toward handback on player look input. Omission carries no story or score consequence.'
        : isHearthHandback
          ? 'Remain in the player current valid frame and release all cue owners continuously in place; no final dolly, forced postcard, or completion fade is permitted.'
          : shot.beat === 'ch7-board'
        ? 'Commit the cockpit owner only behind the physical seal; interruption restores the last validated sole owner.'
        : 'Clear the shot-owned pose, gaze, FOV, bars, grade, bloom, and outline at the semantic exit while preserving the player look and physical state.',
    },
    variantRefs,
    resetRef: 'reset-camera',
    evidenceRefs: ['cinematography-treatment.md#shot-ledger-direction-a', 'cinematography-treatment.md#capture-and-review-specification'],
  }
})

const shotForAnchor = (anchor) => {
  const exactStart = shots.find((shot) => shot.startAnchorRef === anchor)
  if (exactStart) return exactStart
  const exactEnd = shots.find((shot) => shot.endAnchorRef === anchor)
  if (exactEnd) return exactEnd
  const beat = anchorBeat.get(anchor)
  return shots.find((shot) => shot.beat === beat)
}

const storyEvents = allAnchors.map((anchor, index) => {
  const beat = anchorBeat.get(anchor)
  const isArrivalBoundary = anchor === 'anc.audit.arrival-handback'
  const isSiblingTarget = anchor === 'anc.crossing.sibling-targeted'
  return {
    id: `evt.${anchor.slice(4)}`,
    beat,
    anchorRef: anchor,
    event: eventSignalByAnchor[anchor],
    playerAction: actionForBeat[beat],
    stateBeforeRefs: index === 0 ? ['shipped-visual-baseline.json#anc.audit.arrival-handback'] : [allAnchors[index - 1]],
    stateAfterRefs: [anchor],
    causeRefs: index === 0 ? ['story-intent.md#grounding'] : [allAnchors[index - 1]],
    payoffRefs: index === allAnchors.length - 1 ? ['story-intent.md#free-play'] : [allAnchors[index + 1]],
    revealRefs: [revealForBeat[beat]],
    informationRevealed: isSiblingTarget
      ? `The legal target is exactly ${tidegardenIdentityText}. All other destination identity remains invalid and A5 remains withheld.`
      : `At ${anchor}, the player receives only the evidence licensed for ${revealForBeat[beat]}; protected causes and later reveals remain withheld.`,
    acceptanceCriterion: isArrivalBoundary
      ? 'The first audit frame preserves symbolic auth.arrival.handback.camera and auth.arrival.handback.effects without interpolation or correction. Headed telemetry must authenticate owner, pose, forward, up, FOV, reality authority, life fields, grade, exposure, and temporary effect owners before any numeric transition is authored.'
      : isSiblingTarget
        ? `The authoritative target event supplies ${tidegardenIdentityText} unchanged to story, score, cinematography, world preparation, cache, route, save, and renderer consumers. Coordinate-only and seed-only derivation fail acceptance; any profile version or hash change regenerates this contract and its exact-anchor evidence.`
        : `The authoritative signal ${eventSignalByAnchor[anchor]} is committed or explicitly optional, physical state matches it, and no fallback or rescue is counted as narrative acceptance.`,
  }
})

const syncAnchors = allAnchors.map((anchor, order) => {
  const beat = anchorBeat.get(anchor)
  const shot = shotForAnchor(anchor)
  const isArrivalBoundary = anchor === 'anc.audit.arrival-handback'
  const isSiblingTarget = anchor === 'anc.crossing.sibling-targeted'
  const isPreTargetCrossing = beat === 'ch8-crossing' && anchor === 'anc.crossing.origin-lookback'
  return {
    id: anchor,
    beat,
    order,
    event: eventSignalByAnchor[anchor],
    source: /optional/.test(eventSignalByAnchor[anchor]) ? 'player-action' : 'runtime-event',
    story: { eventRef: `evt.${anchor.slice(4)}`, relation: 'at', offsetMs: 0 },
    score: [{ cueRef: cueByBeat[beat].id, relation: isPreTargetCrossing ? 'before' : 'at', offsetMs: 0, musicalIntent: isPreTargetCrossing ? 'Origin bed only. No destination motif, key, profile, or palette may arm before the complete canonical Tidegarden target bundle commits.' : cueByBeat[beat].phrase }],
    cinematography: [{ shotRef: shot.id, relation: 'at', offsetMs: 0, visualIntent: isSiblingTarget ? `${shot.focalHierarchy.primary}; every visual, renderer, palette, cache, and approach consumer resolves the same ${tidegardenIdentityText}.` : shot.focalHierarchy.primary }],
    acceptanceCriterion: isArrivalBoundary
      ? 'Story, score, and camera preserve symbolic auth.arrival.handback.camera and auth.arrival.handback.effects on the same first audit frame. The equal numeric FOV fields are baseline schema mirrors only; headed telemetry is required before any numeric camera or effect transition.'
      : isSiblingTarget
        ? `Story, score, cinematography, world preparation, cache, route, save, and renderer telemetry all receive ${tidegardenIdentityText} on the same causal event. Coordinate-only and seed-only derivation are forbidden; a changed profile version or hash invalidates the evidence and requires contract regeneration.`
        : `Story, score, and camera telemetry identify ${anchor} on the same pause-aware causal rail; physical truth remains valid with audio muted and post effects disabled.`,
  }
})

const revealLedger = [
  ['rev-w7744-limited-world', 'W-7744 genuinely perceives less and is frightened rather than merely lying.', 'player-inference', 'player-inference', true, 'Repeated fire, life, tree, and chromatic mismatch behavior supports inference without granting interior access.'],
  ['rev-compliance-self-diminishes', 'Obedience can reduce the observer lived world.', 'contracted-future', 'player-visible', false, 'The player performs both transactions and remains inside the continuous material and musical regression.'],
  ['rev-will-is-an-act', 'Terra can choose a purpose not issued by Authority.', 'player-inference', 'player-visible', false, 'The protected tree, harmless tool refusal, lowercase command, and committed no are all player-performed.'],
  ['rev-a4-alive', 'Life was beyond the prior renderer and is not manufactured by a technology upgrade.', 'contracted-future', 'resolved', false, 'Alive authority commits before one physical front crosses the retained frame and leaves persistent world life.'],
  ['rev-w7744-contradiction', 'Life W-7744 cannot perceive can alter his physical route.', 'author-only', 'player-inference', true, 'A branch and changed route tear the pack without proving a conscious planet or exposing W-7744 thoughts.'],
  ['rev-purpose-after-power', 'A self-powered tool still waits for chosen direction.', 'contracted-future', 'player-visible', true, 'Maw repair returns control before any target highlight or forced test and accepts harmless use or withholding.'],
  ['rev-body-counts', 'Water makes inherited bodily limits explicit.', 'author-only', 'player-visible', true, 'Meaningful submersion authors oxygen and only legal surfacing proves Returned With Breath.'],
  ['rev-wreck-remembers', 'The drowned Keel Memory holds structural history and the sibling address.', 'contracted-future', 'player-visible', false, 'Maw resonance, physical freeing, dry banking, and bench projection disclose machinery memory without planetary intention.'],
  ['rev-repair-reinterprets', 'Restoration changes what inherited machinery is for without erasing scars.', 'contracted-future', 'player-visible', false, 'Every monotonic stage remains visible on the same scarred wreck and flight readiness enables a chosen route.'],
  ['rev-distance-enlarges-relation', 'Seeing origin as a whole changes scale without reducing meaning.', 'contracted-future', 'player-inference', true, 'Optional lookback, two coherent bodies, physical crossing, and preserved return permit inference without forced spectacle.'],
  ['rev-abundance-is-choice', 'Plenty intensifies responsibility because relationships overlap resources.', 'author-only', 'player-visible', true, 'Scanner relationships, accessible Attend, site validation, local material, and free layout replace loot shower and morality score.'],
  ['rev-home-between-worlds', 'A second hearth can enlarge home without replacing the first.', 'contracted-future', 'player-inference', true, 'A player-built shelter, safe rest, optional origin-facing opening, persistent ship, and returnable route preserve both worlds.'],
  ['rev-worker9-trace', 'Some embodied knowledge may not originate in Terra conscious record.', 'author-only', 'protected-open', true, 'One ambiguous hidden repair catch may survive; oxygen pressure carries no repeated identifiable W cell and no line names Worker 9.'],
  ['rev-a5-deferred', 'The larger prison and first interstellar warp remain ahead.', 'contracted-future', 'protected-open', true, 'Local physical travel uses no warp tunnel, Light-stage bloom, galactic language, or A5 major cadence.'],
].map(([id, subject, levelBefore, levelAfter, protectedQuestion, playerEvidence]) => ({
  id, subject, levelBefore, levelAfter,
  setupRefs: ['story-intent.md#reveal-and-payoff-ledger'],
  payoffRefs: ['story-intent.md#non-negotiable-causal-spine'],
  playerEvidence,
  protectedQuestion,
}))

const characterDynamics = [
  { id: 'dyn.terra', characterRef: 'Terra', desire: 'Protect unrequested value and discover what chosen capability is for.', opposition: 'Issued purpose, bodily limits, inherited machinery, and the temptation to treat abundance as entitlement.', tactic: 'Attend, refuse, repair, test, return, and adapt through player-authored action.', beliefBefore: 'Another observer arrival may restore the old frame around the living world.', beliefAfter: 'Agency can direct tools without being defined by them, and home can remain a returnable relation.', playerVisibleEvidenceRefs: ['story-intent.md#character-and-causal-spine'], revealRefs: ['rev-will-is-an-act', 'rev-purpose-after-power', 'rev-home-between-worlds'] },
  { id: 'dyn.w7744', characterRef: 'W-7744', desire: 'Restore a world matching his authorized model and remove perceived contamination.', opposition: 'Warmth without source, life filed as noise, the impossible tree, and his own first fault.', tactic: 'Inspect, classify, compel, verify again, then flee and file the anomaly.', beliefBefore: 'Regulation and perception are the same truth.', beliefAfter: 'His settled belief remains inaccessible; only his renderer fault and physically altered route are knowable.', playerVisibleEvidenceRefs: ['story-intent.md#character-and-causal-spine'], revealRefs: ['rev-w7744-limited-world', 'rev-w7744-contradiction'] },
  { id: 'dyn.worker9', characterRef: 'Worker 9 unresolved presence', desire: 'No explicit desire is assigned in this contract.', opposition: 'The interface renders one first person and cannot name the source of embodied foreknowledge.', tactic: 'At most one hand catch persists beneath repair while physiological oxygen evidence remains non-musical.', beliefBefore: 'Hidden survival is author canon and not player knowledge.', beliefAfter: 'The trace remains unresolved and multiply readable.', playerVisibleEvidenceRefs: ['story-intent.md#protected-questions-and-authored-withholding'], revealRefs: ['rev-worker9-trace'] },
  { id: 'dyn.authority', characterRef: 'The Authority', desire: 'Convert contradiction into error and participation into cure.', opposition: 'Terra lived evidence, W-7744 fault, and machinery repurposed beyond quota.', tactic: 'Euphemism, forced complicity, classification, and issued access.', beliefBefore: 'Unindexed perception is contamination.', beliefAfter: 'Locally disobeyed but neither defeated nor explained.', playerVisibleEvidenceRefs: ['story-intent.md#character-and-causal-spine'], revealRefs: ['rev-compliance-self-diminishes', 'rev-will-is-an-act'] },
  { id: 'dyn.living-worlds', characterRef: 'Origin and Tidegarden as living worlds', desire: 'No humanlike motive is assigned.', opposition: 'Reduction into scenery, loot map, or moral reward dispenser.', tactic: 'Physical and ecological relationships disclose consequence without grading the player.', beliefBefore: 'Origin is lived while Tidegarden is only an address inside damaged machinery.', beliefAfter: 'Two persistent, different worlds can be related without either becoming property.', playerVisibleEvidenceRefs: ['story-intent.md#character-and-causal-spine'], revealRefs: ['rev-a4-alive', 'rev-abundance-is-choice', 'rev-home-between-worlds'] },
]

const scoreCues = beats.map((beat) => ({
  id: cueByBeat[beat].id,
  cueRef: null,
  type: beat === 'ch4-defy' ? 'silence' : 'music',
  anchorRef: beat === 'ch8-crossing' ? 'anc.crossing.sibling-targeted' : anchorsByBeat[beat][0],
  relation: 'at',
  offsetMs: 0,
  phraseIntent: cueByBeat[beat].phrase,
  barIntent: cueByBeat[beat].bar,
  mixIntent: cueByBeat[beat].mix,
  silenceIntent: cueByBeat[beat].silence,
  resetRef: 'reset-score',
  evidenceRefs: ['score-treatment.md#cue-ledger', 'score-treatment.md#authoritative-event-trigger-matrix'],
}))

const contract = {
  schema: 'paravoxia.sceneContract.v1',
  sceneId: 'distance-between-fires',
  contractVersion: 'intent-v1',
  status: 'frozen',
  supersedesVersion: null,
  production: {
    mode: lock.mode,
    authorityRefs: lock.authority.map((entry) => `${entry.path}#${entry.section}`),
    productionLockRef: 'production-lock.json',
    mutationBoundary: lock.mutationBoundary,
    allowedPaths: [...lock.allowedPaths],
    protectedPaths: [...lock.protectedPaths],
    ownerDecisionRefs: [...lock.currentRestrictions.copyChangeDecisionRefs],
    canonicalPreviewUrl: lock.canonicalPreviewUrl,
    frozenAt: existingContract?.production?.frozenAt ?? lock.frozenAt,
  },
  scope: {
    title: 'The Distance Between Fires — refusal, repair, local crossing, and a returnable second hearth',
    beats,
    shippedReferenceRefs: ['shipped-reference-map.md#shipped-reference', 'shipped-visual-baseline.json'],
    priorEvidenceRefs: ['shipped-visual-baseline.json', '../../../captures/paravoxia-full-run.webm'],
    targetDevices: ['desktop', 'mobile'],
    targetQualityTiers: ['high', 'medium', 'low', 'potato'],
    nonGoals: [
      'No A5, interstellar warp, galaxy reveal, radial tunnel, Light-stage escalation, or resolved prison cosmology.',
      'No pristine replacement ship, volcanic or frozen sibling, morality score, prescribed settlement layout, or conquest framing.',
      'No new full-screen render pass, unbuilt depth of field, screen-space reflection, caustic, dynamic-shadow, or painterly dependency.',
      'No protected audio asset or protected score and bed engine mutation in this production boundary.',
    ],
  },
  story: {
    intentRef: 'story-intent.md',
    purpose: 'Let the player perform a small refusal, discover that power still requires chosen direction, recover and reinterpret damaged machinery, cross physically to a distinct abundant sibling, and make a shelter whose hearth enlarges rather than replaces home.',
    emotionalBefore: 'The living origin has just survived another observer arrival and risks being reduced again to an authorized model.',
    emotionalAfter: 'The player has maintained a real relation between two different worlds and returns to free play with capability, scars, questions, and agency intact.',
    intendedAmbiguity: 'W-7744 interior truth, the source of embodied repair knowledge, planetary ontology, and the larger A5 structure remain protected; causal transactions, body limits, world identities, and player choices remain explicit.',
    nonNegotiableCanon: [
      'The authentic arrival is not replayed; audit inherits its first frame and A4 alone commits material-to-alive authority.',
      'The two compliance acts and lowercase refusal are player-performed; fallback and rescue never count as acceptance.',
      'The Maw becomes capable before purpose is chosen, the tree remains protected, and no forced test target appears.',
      'The dive requires meaningful submersion, oxygen, physical Keel freeing, legal surfacing, and dry banking.',
      'The same scarred wreck advances through five authoritative repair stages before boarding, launch, or route access.',
      `Tidegarden's indivisible canonical identity is ${tidegardenIdentityText}. Every consumer receives the complete bundle; coordinate-only and seed-only derivation are forbidden, and any profile version or hash change requires contract and exact-anchor evidence regeneration.`,
      'Settlement observations remain optional records; accessible Attend may satisfy comprehension and layout remains free.',
      'A5 remains deferred and no local travel or hearth cadence spends its visual or harmonic capital.',
    ],
    realityStageCeiling: 'alive',
    characterDynamics,
    revealLedger,
    events: storyEvents,
    agencyWindows,
  },
  syncAnchors,
  cinematography: {
    treatmentRef: 'cinematography-treatment.md',
    thesis: 'Thresholds remember: one embodied camera lineage preserves prior frames, physical ownership, surface support, scars, waterlines, hatches, planetary limbs, and player-built openings while existing Three.js effects enrich rather than manufacture truth.',
    currentCutRefs: ['shipped-reference-map.md#shipped-reference', 'shipped-visual-baseline.json', '../../../captures/paravoxia-full-run.webm'],
    adjacentSceneRefs: ['story-intent.md#grounding', 'main/src/story/storyDirector.ts'],
    cameraLineage: ['player-camera', 'cinematic-look', 'lens-rig'],
    paletteRef: 'pal.distance-between-fires',
    shotOrder: shots.map((shot) => shot.id),
  },
  palette: {
    id: 'pal.distance-between-fires',
    family: 'planet-derived',
    sourceRefs: ['cinematography-treatment.md#current-semantic-palette-references', 'main/src/utils/planetVisualProfile.ts', 'main/src/story/tidegardenRoute.ts'],
    semanticRoles: [
      { id: 'pal.origin-ground', role: 'Origin warm green earth and leaf continuity', valueRef: 'origin.terrain.primary', hex: '#587836', usage: 'Carry origin material dawn and keep the protected tree readable by value and silhouette through compliance.' },
      { id: 'pal.origin-water', role: 'Origin turquoise pond and dive surface', valueRef: 'origin.water.shallow', hex: '#59c5c1', usage: 'Define the pond, submersion boundary, and open-air return without making cyan a generic objective glow.' },
      { id: 'pal.authority-ember', role: 'Scarce regulation and W-7744 accent', valueRef: 'authority.regulation.ember', hex: '#ff5a3c', usage: 'Remain confined to Authority lineage, W-7744 separation, and machine warning; never seed landscape danger.' },
      { id: 'pal.repair-cyan', role: 'Scarce repair, navigation, and relationship trace', valueRef: 'technology.repair.cyan', hex: null, usage: 'Mark Maw seams, reconstruction topology, route logic, and scanner relation lines without becoming a biome wash.' },
      { id: 'pal.tide-water', role: 'Tidegarden lapis-blue braided shallows', valueRef: 'tidegarden.water.shallow', hex: '#59a1c5', usage: 'Separate the sibling hydrology and wet terraces from origin while keeping water boundaries physically legible.' },
      { id: 'pal.tide-canopy', role: 'Tidegarden cobalt and blue-violet fan canopy', valueRef: 'tidegarden.canopy.base', hex: '#1f54a3', usage: 'Establish distinct verdant morphology and layered canopy mass on every quality tier.' },
      { id: 'pal.tide-shelf', role: 'Shared bark ancestry and warm ivory shelf material', valueRef: 'tidegarden.shelf.light', hex: '#bfa77d', usage: 'Carry resource, geology, built shelter, and warm material continuity without implying ownership.' },
      { id: 'pal.tide-coral', role: 'Scarce Tidegarden reproductive and living accent', valueRef: 'tidegarden.reproductive.accent', hex: '#e53ea4', usage: 'Appear only on selected life and reproductive structure; never illuminate every collectible or site.' },
    ],
    continuityRefs: ['cinematography-treatment.md#color-script-and-rendering-causality', 'shipped-visual-baseline.json', 'main/src/utils/planetArtDirection.ts'],
    focalAccent: { roleRef: 'pal.tide-coral', scarcityIntent: 'Coral remains a rare living punctuation; repair cyan and authority ember remain separate shaped languages so the two worlds retain distinct meaning.' },
    anomaly: { brokenRule: 'Origin warm green and Tidegarden humid cyan-blue share bark and shelf ancestry while reversing canopy and hydrology organization.', storyReason: 'The sibling must feel verdant and related without reading as a recolor, volcanic contrast planet, or frozen biome.' },
  },
  shots,
  score: {
    treatmentRef: 'score-treatment.md',
    mood: 'A subtractive authorized square-fifth language gives way to embodied Dorian and quartal breath, repaired instrumental accumulation, physical local distance, and a bounded two-world counterpoint that refuses final cadence.',
    eraFidelity: 'Reuse the deterministic procedural score and bed vocabulary through adapters outside protected engines; no protected audio asset, score-engine, or bed-engine edit is licensed.',
    cues: scoreCues,
    mixIntent: 'Dialogue, breath, oxygen, physical transactions, navigation warnings, ecology, construction, and interaction lead. Score names relationship but never certifies a task or masks a verb.',
    performancePlan: 'Prewarm cue graphs and bounded procedural layers; preserve the current voice and node budget, add no audio-file dependency, create no steady per-frame allocations, and prove pause, reload, mute, mobile, and quality-tier equivalence.',
    evidenceRefs: ['score-treatment.md#cue-ledger', 'score-treatment.md#performance', 'audio-report.md'],
  },
  variants: {
    desktop: { id: 'variant-desktop', preservedFocalSubject: 'The current physical cause and player-authored subject at every semantic anchor.', preservedMeaning: 'Refusal, bodily cost, repair, ownership, distance, abundance, and home remain physical and player-readable.', cameraChanges: 'Capture 16:9 and 21:9 with pointer lock; retain the embodied lineage and central body-safe area.', effectChanges: 'Use the existing High stack only after prewarm and preserve post-off geometry and material truth.', agencyChanges: 'Keyboard, mouse, controller, and movie intent adapter drive the same authoritative actions and controllers.', evidenceRefs: ['cinematography-treatment.md#desktop-and-mobile', 'screenshot-report.md#desktop'] },
    mobile: { id: 'variant-mobile', preservedFocalSubject: 'One causal subject at a time inside the touch-safe frame.', preservedMeaning: 'Every required relationship remains available through sequential blocking, surface-tangent guidance, and accessible Attend.', cameraChanges: 'Re-rank subjects for portrait and landscape; preserve touch look, hatch coverage, FOV-aware cockpit scale, and captions above controls.', effectChanges: 'Reduce density and decorative motion before removing canonical silhouettes, material state, oxygen shape, route proxies, or shelter value.', agencyChanges: 'Expose the same explicit verbs, holds, swim, flight, landing, placement, and rest through touch-safe controls.', evidenceRefs: ['cinematography-treatment.md#desktop-and-mobile', 'screenshot-report.md#mobile'] },
    reducedMotion: { id: 'variant-reduced-motion', preservedFocalSubject: 'The same physical cause at the same semantic anchor in a stable player-owned frame.', preservedMeaning: 'All story state, timing, choices, thresholds, and ownership transfers remain equivalent without forced movement.', cameraChanges: 'Hold on-foot at 75 degrees and cockpit at 70 to 72; disable look pulls, traveling exterior boom, sway, wobble, FOV pumps, and smear.', effectChanges: 'Replace flash with neutral local material change and keep geometry, value, icons, captions, oxygen, and physical occlusion.', agencyChanges: 'Player input remains dominant; static occlusion plates and accessible Attend preserve required actions.', evidenceRefs: ['cinematography-treatment.md#reduced-motion-reduced-flash-muted-audio-and-color-vision', 'screenshot-report.md#reduced-motion'] },
    qualityTiers: [
      { id: 'quality-high', tier: 'high', preservedFocalSubject: 'The authoritative physical subject and route.', preservedMeaning: 'All semantic evidence remains geometry and material first.', simplifications: [], paletteFallback: 'Use the full deterministic atlas and planet-derived semantic palette.', effectFallback: 'Existing AO, bloom, haze, god rays, particles, and flight feedback may enrich only after prewarm and within the existing stack.', evidenceRefs: ['cinematography-treatment.md#lowest-quality-semantic-parity', 'screenshot-report.md#quality-high'] },
      { id: 'quality-medium', tier: 'medium', preservedFocalSubject: 'The authoritative physical subject and route.', preservedMeaning: 'All semantic evidence remains geometry and material first.', simplifications: ['Reduce decorative density, ray count, particles, and secondary post intensity before canonical actors or routes.'], paletteFallback: 'Preserve semantic values and sparse accents with fewer instances.', effectFallback: 'Use material shifts, bounded emissive, local light, FogExp2, and physical silhouettes when expensive enrichment drops.', evidenceRefs: ['cinematography-treatment.md#lowest-quality-semantic-parity', 'screenshot-report.md#quality-medium'] },
      { id: 'quality-low', tier: 'low', preservedFocalSubject: 'The authoritative physical subject and route.', preservedMeaning: 'Life front, waterline, repair stages, bodies, landing support, and shelter geometry remain unmistakable.', simplifications: ['Use lower LOD, fewer decorative meshes, merged static repair geometry, and no ornamental particle dependence.'], paletteFallback: 'Keep origin and Tidegarden value organization, topology, and shaped accent languages.', effectFallback: 'Use prewarmed material uniforms, geometric medium, silhouettes, and state-driven practical light with post disabled if necessary.', evidenceRefs: ['cinematography-treatment.md#lowest-quality-semantic-parity', 'screenshot-report.md#quality-low'] },
      { id: 'quality-potato', tier: 'potato', preservedFocalSubject: 'Canonical ecology floor, route proxy, physical machinery topology, water boundary, body, and shelter threshold.', preservedMeaning: 'The world can simplify but cannot become empty or turn story evidence into text alone.', simplifications: ['Use cheap instanced blade and canopy masses, one herd or route group, geometric aperture, oxygen shapes, merged hull stages, and no decorative post.'], paletteFallback: 'Retain origin green-gold and Tidegarden cyan-blue, cobalt, ivory, and scarce coral roles in flat material value.', effectFallback: 'Geometry, material topology, bounded emissive, FogExp2, icons, captions, and locomoting route proxies carry every causal truth.', evidenceRefs: ['cinematography-treatment.md#lowest-quality-semantic-parity', 'screenshot-report.md#quality-potato'] },
    ],
  },
  performance: {
    targetFps: 60,
    minimumFps: 30,
    maximumFrameTimeMs: 33.4,
    maximumDrawCalls: 180,
    maximumShaderPrograms: 48,
    maximumGpuMemoryMb: 1024,
    deviceProfiles: ['cinematography-treatment.md#frame-shader-draw-and-memory-budgets', 'desktop-flagship-native-dpr', 'representative-mobile-touch'],
    criticalAnchors: ['anc.a4.life-front', 'anc.maw.repair-committed', 'anc.dive.waterline', 'anc.reconstruct.calibration', 'anc.launch.atmosphere-exit', 'anc.crossing.local-handoff', 'anc.landfall.touchdown', 'anc.settle.first-foundation', 'anc.hearth.ecology-night'],
    measurementPlan: 'Measure p50, p95, and p99 CPU and GPU frame time, draw calls, triangles, programs, JavaScript heap, and GPU memory before, at, and after every critical anchor. Require zero shader compilation and zero geometry or material allocation inside each plus-or-minus two-second anchor window, no monotonic memory growth across repeated local crossings, and no A4 peak beyond settled alive by more than five draws and one precompiled program.',
  },
  reset: {
    triggers: ['beat-exit', 'deep-link', 'replay', 'pause', 'quit', 'focus-loss', 'completion', 'sandbox'],
    states: [
      { id: 'reset-camera', domain: 'camera', stateRef: 'main/src/story/sceneAvCueRail.ts', resetValue: 'On foot: player owner, FOV 75, pose and gaze weights zero. In vehicle: sole vehicle owner, state-derived FOV 70, feedback zero at zero thrust.', triggers: ['beat-exit', 'deep-link', 'replay', 'pause', 'quit', 'focus-loss', 'completion', 'sandbox'], acceptanceCriterion: 'No cinematic pose, gaze target, FOV envelope, roll, or second writer survives the declared boundary.' },
      { id: 'reset-grade', domain: 'grade', stateRef: 'main/src/components/effects/PostFX.tsx', resetValue: 'Clear Story grade owner and restore the current state-derived world profile.', triggers: ['beat-exit', 'deep-link', 'replay', 'quit', 'completion', 'sandbox'], acceptanceCriterion: 'No Story grade survives free play, sandbox, world transfer, or reconstruction beyond its contracted persistent state.' },
      { id: 'reset-lighting', domain: 'lighting', stateRef: 'main/src/game/systems/realityRenderSystem.ts', resetValue: 'Clear temporary local-light and exposure owners; retain only committed world, ship, station, and time-of-day sources.', triggers: ['beat-exit', 'deep-link', 'replay', 'quit', 'completion', 'sandbox'], acceptanceCriterion: 'No temporary light or exposure conceals physical state, doubles after replay, or leaks between worlds.' },
      { id: 'reset-effects', domain: 'effect', stateRef: 'main/src/story/sceneAvCueRail.ts', resetValue: 'Clear temporary bloom, outline, underwater medium, flight feedback, density ramp, bars, and punctuation owners.', triggers: ['beat-exit', 'deep-link', 'replay', 'pause', 'quit', 'focus-loss', 'completion', 'sandbox'], acceptanceCriterion: 'The rail samples an empty object in sandbox and no transient effect survives its semantic exit or reconstructs as a one-shot.' },
      { id: 'reset-score', domain: 'score', stateRef: 'main/src/components/audio/AudioDirector.tsx', resetValue: 'Clear authored overlay and envelope owner; derive steady cue or bed state from committed beat, repair, vehicle, and world identity.', triggers: ['beat-exit', 'deep-link', 'replay', 'pause', 'quit', 'focus-loss', 'completion', 'sandbox'], acceptanceCriterion: 'No pickup, repair, front, route, exit, landing, or rest punctuation replays from reconstruction and muted operation cannot block story.' },
      { id: 'reset-story', domain: 'story', stateRef: 'main/src/story/storyState.ts', resetValue: 'Reconstruct the latest monotonic event, unique-item receipt, vehicle owner, world owner, and safe boundary without manufacturing acceptance.', triggers: ['deep-link', 'replay', 'quit', 'focus-loss', 'completion', 'sandbox'], acceptanceCriterion: 'Transactions and unique items remain exactly once, optional observations remain optional, and rescue never awards a gated accomplishment.' },
    ],
    sandboxNoOp: { required: true, criterion: 'With Story inactive, the scene rail samples an empty object and player, world, vehicle, post, and audio paths match shipped sandbox behavior except separately contracted canonical Tidegarden content.' },
    probeRefs: ['main/src/story/sceneAvCueRail.test.ts', 'main/src/story/storyDirector.test.ts', 'main/src/story/storyState.test.ts', 'main/src/story/tidegardenRoute.test.ts'],
  },
  evidence: {
    acceptanceCriteria: [
      'All 66 semantic anchors produce exact story, score, camera, effect, and control traces on one pause-aware rail.',
      'The first audit frame preserves symbolic auth.arrival.handback.camera and auth.arrival.handback.effects exactly; headed telemetry authenticates owner, pose, forward, up, FOV, reality authority, life fields, grade, exposure, and temporary effect owners before numeric transitions are authored.',
      'Three cold runs and one movie-mode run complete without timeout rescue, water walking, terrain intersection, camera ownership collision, or duplicate receipt.',
      'A4 physical geometry and material become visible at the fixed front with audio muted and post disabled; optional punctuation cannot move the event.',
      'Maw repair, Keel acquisition and bank, five ship stages, boarding, flight readiness, and Tidegarden targeting are authoritative, monotonic, replay-safe, and exactly once.',
      `At anc.crossing.sibling-targeted, every consumer records the indivisible ${tidegardenIdentityText}; coordinate-only and seed-only derivation fail, and a profile version or hash change invalidates and regenerates the contract evidence.`,
      'NPC, player, ship, and egress spawn and locomotion remain on validated support, avoid water unless authored, and never correct height through visible nonphysical interpolation.',
      'Desktop, mobile, reduced-motion, High, and Potato preserve the same focal subject, agency, world identity, and causal meaning.',
      'No protected path changes, no new full-screen pass, no A5 grammar, and no publication occur under this contract.',
      'Headed real-GPU taste approval remains required after mechanical checks and before any release decision.',
    ],
    captures: [
      { id: 'cap.exact-anchors', kind: 'exact-frame', anchorRefs: allAnchors, variantRefs: ['variant-desktop', 'quality-high', 'quality-potato'], pathOrPlanRef: 'screenshot-report.md#anchor', status: 'planned', acceptanceCriterion: `Each semantic anchor has an exact frame and telemetry sample proving focal hierarchy, FOV, camera owner, physical state, post-off truth, and quality parity. Arrival authenticates the symbolic handback before numeric transitions; sibling targeting records ${tidegardenIdentityText} for every consumer.` },
      { id: 'cap.transition-strips', kind: 'dense-frame-strip', anchorRefs: ['anc.a4.life-front', 'anc.maw.repair-committed', 'anc.dive.waterline', 'anc.reconstruct.calibration', 'anc.board.camera-transfer', 'anc.launch.atmosphere-exit', 'anc.crossing.local-handoff', 'anc.landfall.egress', 'anc.hearth.freeplay-handback'], variantRefs: ['variant-desktop', 'variant-mobile', 'variant-reduced-motion', 'quality-potato'], pathOrPlanRef: 'cinematography-treatment.md#dense-transition-strips', status: 'planned', acceptanceCriterion: 'Dense strips show no pop, cut, duplicated writer, hidden rescue, late physical truth, or residual override across every risky transition.' },
      { id: 'cap.score-anchors', kind: 'audio', anchorRefs: allAnchors, variantRefs: ['variant-desktop', 'variant-mobile', 'variant-reduced-motion', 'quality-potato'], pathOrPlanRef: 'audio-report.md#cue', status: 'planned', acceptanceCriterion: 'Audio trace proves event-derived cue state, protected mix priority, fixed A4 causal front, mute independence, and no replayed one-shot.' },
      { id: 'cap.performance-critical', kind: 'performance-trace', anchorRefs: ['anc.a4.life-front', 'anc.maw.repair-committed', 'anc.dive.waterline', 'anc.reconstruct.calibration', 'anc.crossing.local-handoff', 'anc.hearth.ecology-night'], variantRefs: ['variant-desktop', 'variant-mobile', 'quality-high', 'quality-potato'], pathOrPlanRef: 'cinematography-treatment.md#frame-shader-draw-and-memory-budgets', status: 'planned', acceptanceCriterion: 'Measured frame, draw, program, allocation, heap, and GPU-memory budgets meet the frozen limits without semantic deletion.' },
      { id: 'cap.reset-probes', kind: 'reset-probe', anchorRefs: ['anc.audit.arrival-handback', 'anc.a4.handback', 'anc.dive.shore-bank', 'anc.board.cockpit-handback', 'anc.landfall.handback', 'anc.hearth.freeplay-handback'], variantRefs: ['variant-desktop', 'variant-mobile', 'variant-reduced-motion', 'quality-potato'], pathOrPlanRef: 'cinematography-treatment.md#reset-replay-and-reconstruction-plan', status: 'planned', acceptanceCriterion: 'Replay, deep link, pause, focus loss, quit, completion, and sandbox leave no camera, score, effect, ownership, receipt, or medium leak.' },
    ],
    mechanicalChecks: [
      { id: 'check.creative-contract', commandOrProbeRef: 'npm --prefix main run creative:gate -- --run ../.codex/production-runs/2026-07-13-distance-between-fires --phase contract', status: 'planned', resultRef: null, acceptanceCriterion: 'The contract gate passes after three directors independently sign these exact scene-contract bytes.' },
      { id: 'check.client-verify', commandOrProbeRef: 'npm --prefix main run verify', status: 'planned', resultRef: null, acceptanceCriterion: 'Client typecheck, tests, build, story authority, budgets, and smoke checks pass without weakening thresholds.' },
      { id: 'check.server-verify', commandOrProbeRef: 'npm --prefix server run verify', status: 'planned', resultRef: null, acceptanceCriterion: 'Server authority, replay receipt, transaction, world identity, and multiplayer checks pass.' },
      { id: 'check.diff-scope', commandOrProbeRef: 'git diff --check and protected-path review', status: 'planned', resultRef: null, acceptanceCriterion: 'Diff is whitespace-clean, stays within allowed paths, and changes no protected audio or deployment path.' },
    ],
    continuity: {
      previousBeatRefs: ['ch4-arrival', 'shipped-visual-baseline.json'],
      nextBeatRefs: ['freeplay.tidegarden', 'story-intent.md#non-goals'],
      paletteRefs: ['cinematography-treatment.md#color-script-and-rendering-causality', 'main/src/utils/planetVisualProfile.ts'],
      lensRefs: ['cinematography-treatment.md#lens-authority-and-safe-area-key', 'main/src/story/sceneAvCueRail.ts'],
    },
    headedTaste: { required: true, realGpuRequired: true, status: 'pending', decisionRef: null },
    directorSignoffsRef: 'director-signoffs.json',
  },
}

let dissent = read('dissent-register.md')
dissent = dissent.replace(
  'The existing shipped baseline metadata reports `alive` at 50 degrees, while the authored continuation expects an authenticated, zero-pop handback and an embodied 75-degree audit path.',
  'The existing shipped baseline metadata conflicts with the authored semantic boundary, while the exact incoming pose, FOV, reality authority, life fields, and temporary effect vector remain unauthenticated until headed telemetry. No numeric camera or effect transition may be inferred from the metadata alone.',
)
dissent = dissent.replace(
  'reality authority, active life fields, and temporary effect owners. If the\nauthentic handback already committed full alive authority, implementation stops',
  'reality authority, active life fields, and temporary effect owners. The contract preserves these as symbolic `auth.arrival.handback.camera` and `auth.arrival.handback.effects`; equal numeric schema fields are metadata mirrors only and license no interpolation. If the\nauthentic handback already committed full alive authority, implementation stops',
)
dissent = dissent.replace(
  'resolve canonical `-1,-1:p1`, seed `1600321158`, and its profile identity;\n  coordinate-only destination derivation is forbidden.',
  'resolve the indivisible bundle `worldId=-1,-1:p1`, `seed=1600321158`, `profileId=story:tidegarden`, `profileVersion=1` (`story:tidegarden@1`), `profileHash=pf1-eeef3b78`, and `archetype=verdant` for every consumer. Coordinate-only and seed-only derivation are forbidden; a profile version or hash change regenerates the contract and exact-anchor evidence.',
)
fs.writeFileSync(path.join(run, 'dissent-register.md'), dissent)
fs.writeFileSync(path.join(run, 'scene-contract.json'), `${JSON.stringify(contract, null, 2)}\n`)
