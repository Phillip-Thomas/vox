import { afterEach, describe, expect, it } from 'vitest';
import { markMilestone, resetProgression } from '../game/systems/progressionSystem.ts';
import { emitEmergentStoryEvent, resetEmergentStoryEvents } from './emergentStoryEvents.ts';
import {
  SIGNED_SCENE_AV_REVISION,
  SIGNED_SCENE_AV_SHA256,
  activateSignedSceneSemanticEvent,
  enterSignedSceneAvBeat,
  getSignedSceneAvContract,
  getSignedSceneAvDebugSnapshot,
  resetSignedSceneAvRuntime,
  setSignedSceneAvDocumentVisible,
  setSignedSceneAvFocused,
  setSignedSceneAvPaused,
  setSignedSceneAvWindowFocused,
  tickSignedSceneAvRuntime
} from './signedSceneAvRuntime.ts';
import { getStoryMusicEnvelopeSnapshot } from './storyMusicEnvelope.ts';

afterEach(() => {
  resetEmergentStoryEvents();
  resetSignedSceneAvRuntime('sandbox');
  resetProgression();
});

describe('signed scene AV runtime', () => {
  it('loads the actual frozen 66-anchor council contract and every reference resolves', () => {
    const contract = getSignedSceneAvContract();
    expect(contract.source.contractVersion).toBe(SIGNED_SCENE_AV_REVISION);
    expect(contract.source.sha256).toBe(SIGNED_SCENE_AV_SHA256);
    expect(contract.anchors).toHaveLength(66);
    expect(contract.beats).toHaveLength(13);

    const anchors = new Set(contract.anchors.map(anchor => anchor.id));
    const shots = new Set(contract.shots.map(shot => shot.id));
    const cues = new Set(contract.scoreCues.map(cue => cue.id));
    for (const anchor of contract.anchors) {
      expect(anchor.shotRefs.every(ref => shots.has(ref))).toBe(true);
      expect(anchor.scoreCueRefs.every(ref => cues.has(ref))).toBe(true);
    }
    for (const shot of contract.shots) {
      expect(anchors.has(shot.startAnchorRef)).toBe(true);
      expect(anchors.has(shot.endAnchorRef)).toBe(true);
      expect(anchors.has(shot.agency.handBackAnchorRef)).toBe(true);
    }
  });

  it('activates one semantic anchor for story, score, camera and PostFX from a typed event', () => {
    enterSignedSceneAvBeat('ch5-maw');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.a4.handback',
      activationSource: 'beat-boundary',
      shot: { id: 'cin.maw.01-follow-the-tear' }
    });
    emitEmergentStoryEvent({
      id: 'test:maw-kit',
      type: 'maw_repair_kit_acquired',
      payload: { itemId: 'maw_repair_kit' }
    });

    let snapshot = getSignedSceneAvDebugSnapshot();
    expect(snapshot.activatedAnchorIds).toEqual([
      'anc.a4.handback',
      'anc.maw.pack-attended',
      'anc.maw.kit-acquired'
    ]);
    expect(snapshot).toMatchObject({
      anchorId: 'anc.maw.kit-acquired',
      activationSource: 'story-event',
      shot: {
        id: 'cin.maw.03-find-the-catch',
        cameraAuthority: 'cinematic-look',
        agency: { movement: 'player', look: 'player', interaction: 'player' },
        lens: { startFovDeg: 75, endFovDeg: 58, durationMs: 800 }
      },
      score: { cueRefs: ['sc.maw.direction'] },
      postFx: { activeEffectIds: ['fx.maw.03-find-the-catch'] }
    });

    for (let frame = 0; frame < 4; frame++) tickSignedSceneAvRuntime(0.1);
    snapshot = getSignedSceneAvDebugSnapshot();
    expect(snapshot.shot?.lens.appliedFovDeg).toBeCloseTo(66.5, 5);
    for (let frame = 0; frame < 4; frame++) tickSignedSceneAvRuntime(0.1);
    expect(getSignedSceneAvDebugSnapshot().shot?.lens.appliedFovDeg).toBe(58);
  });

  it('rejects out-of-order facts and advances audit anchors monotonically', () => {
    enterSignedSceneAvBeat('ch4-audit');
    emitEmergentStoryEvent({
      id: 'test:audit-life-too-early',
      type: 'audit_mismatch',
      payload: { kind: 'life' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.audit.arrival-handback',
      activatedAnchorIds: ['anc.audit.arrival-handback']
    });

    emitEmergentStoryEvent({
      id: 'test:audit-fire',
      type: 'audit_mismatch',
      payload: { kind: 'fire' }
    });
    emitEmergentStoryEvent({
      id: 'test:audit-life-in-order',
      type: 'audit_mismatch',
      payload: { kind: 'life' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      beat: 'ch4-audit',
      anchorId: 'anc.audit.life-as-noise',
      anchorEvent: 'ev.audit.life-mismatch',
      score: { cueRefs: ['sc.audit.incomplete-model'] },
      activatedAnchorIds: [
        'anc.audit.arrival-handback',
        'anc.audit.fire-check',
        'anc.audit.life-as-noise'
      ]
    });
    emitEmergentStoryEvent({
      id: 'test:audit-tree-in-order',
      type: 'audit_mismatch',
      payload: { kind: 'tree' }
    });
    emitEmergentStoryEvent({
      id: 'test:audit-directive',
      type: 'audit_directive_issued',
      payload: { directive: 'sterilization' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.audit.directive',
      activatedAnchorIds: [
        'anc.audit.arrival-handback',
        'anc.audit.fire-check',
        'anc.audit.life-as-noise',
        'anc.audit.tree-distance',
        'anc.audit.directive'
      ]
    });
  });

  it('fans one accepted compliance transaction into adjacent ordered facts', () => {
    enterSignedSceneAvBeat('ch4-comply');
    emitEmergentStoryEvent({
      id: 'test:compliance-fire',
      type: 'compliance_committed',
      payload: { kind: 'fire' }
    });
    expect(getSignedSceneAvDebugSnapshot().activatedAnchorIds).toEqual([
      'anc.comply.fire-order',
      'anc.comply.fire-commit',
      'anc.comply.organics-order'
    ]);

    emitEmergentStoryEvent({
      id: 'test:compliance-organics',
      type: 'compliance_committed',
      payload: { kind: 'organics' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.comply.regression-floor',
      activatedAnchorIds: [
        'anc.comply.fire-order',
        'anc.comply.fire-commit',
        'anc.comply.organics-order',
        'anc.comply.organics-commit',
        'anc.comply.regression-floor'
      ]
    });
  });

  it('whitelists only genuinely symbolic beat-boundary anchors', () => {
    const expectedEntries = new Map<string, string | null>([
      ['ch4-audit', 'anc.audit.arrival-handback'],
      ['ch4-comply', 'anc.comply.fire-order'],
      ['ch4-defy', 'anc.defy.tree-order'],
      ['a4-exhale', 'anc.a4.held-stillness'],
      ['ch5-maw', 'anc.a4.handback'],
      ['ch6-dive', null],
      ['ch7-reconstruct', null],
      ['ch7-board', null],
      ['ch8-launch', null],
      ['ch8-crossing', null],
      ['ch8-landfall', null],
      ['ch9-settle', null],
      ['ch9-hearth', null]
    ]);
    for (const [beat, anchorId] of expectedEntries) {
      enterSignedSceneAvBeat(beat as Parameters<typeof enterSignedSceneAvBeat>[0]);
      const snapshot = getSignedSceneAvDebugSnapshot();
      expect(snapshot.anchorId, beat).toBe(anchorId);
      expect(snapshot.activationSource, beat).toBe(anchorId ? 'beat-boundary' : null);
      if (!anchorId) {
        expect(snapshot.shot, beat).toBeNull();
        expect(snapshot.postFx.activeEffectIds, beat).toEqual([]);
      }
    }
  });

  it('pauses the rail clock and clears transient camera/effect owners until resume', () => {
    enterSignedSceneAvBeat('ch6-dive');
    emitEmergentStoryEvent({
      id: 'test:waterline',
      type: 'submersion_changed',
      payload: { submerged: true, amount: 0.8 }
    });
    tickSignedSceneAvRuntime(0.3);
    const beforePause = getSignedSceneAvDebugSnapshot();
    expect(beforePause.postFx.activeEffectIds).toEqual(['fx.dive.02-air-stays-above']);

    setSignedSceneAvPaused(true);
    tickSignedSceneAvRuntime(0.1);
    const paused = getSignedSceneAvDebugSnapshot();
    expect(paused.suspended).toBe(true);
    expect(paused.postFx.activeEffectIds).toEqual([]);
    expect(paused.shot?.lens.elapsedMs).toBe(beforePause.shot?.lens.elapsedMs);

    setSignedSceneAvPaused(false);
    const resumed = getSignedSceneAvDebugSnapshot();
    expect(resumed.suspended).toBe(false);
    expect(resumed.postFx.activeEffectIds).toEqual(['fx.dive.02-air-stays-above']);
  });

  it('shares pause and focus-loss suspension with the scene music envelope', () => {
    setSignedSceneAvFocused(false);
    expect(getStoryMusicEnvelopeSnapshot().paused).toBe(true);

    // Multiple suspension reasons compose: restoring focus cannot resume audio
    // while the explicit pause owner still holds.
    setSignedSceneAvPaused(true);
    setSignedSceneAvFocused(true);
    expect(getStoryMusicEnvelopeSnapshot().paused).toBe(true);

    setSignedSceneAvPaused(false);
    expect(getStoryMusicEnvelopeSnapshot().paused).toBe(false);

    setSignedSceneAvWindowFocused(false);
    setSignedSceneAvDocumentVisible(false);
    setSignedSceneAvWindowFocused(true);
    expect(getStoryMusicEnvelopeSnapshot().paused).toBe(true);
    setSignedSceneAvDocumentVisible(true);
    expect(getStoryMusicEnvelopeSnapshot().paused).toBe(false);
  });

  it('rehydrates ordered Maw and dive presentation from durable receipts', () => {
    markMilestone('story:item:maw-repair-kit:acquired');
    markMilestone('maw_repaired');
    markMilestone('story:maw:first-direction-resolved');
    enterSignedSceneAvBeat('ch5-maw');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.maw.direction-handback',
      activationSource: 'semantic-event',
      score: { hit: null },
      activatedAnchorIds: [
        'anc.a4.handback',
        'anc.maw.pack-attended',
        'anc.maw.kit-acquired',
        'anc.maw.repair-begun',
        'anc.maw.repair-committed',
        'anc.maw.direction-handback'
      ]
    });

    resetSignedSceneAvRuntime('deep-link');
    resetProgression();
    enterSignedSceneAvBeat('ch6-dive');
    markMilestone('story:dive:waterline-entered');
    markMilestone('story:dive:oxygen-75');
    markMilestone('story:dive:keel-sonar-revealed');
    tickSignedSceneAvRuntime(0.1);
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.dive.keel-revealed',
      activationSource: 'semantic-event',
      activatedAnchorIds: [
        'anc.dive.waterline',
        'anc.dive.oxygen-authored',
        'anc.dive.keel-revealed'
      ]
    });
  });

  it('does not fabricate or gate on the oxygen threshold when the Keel is found quickly', () => {
    enterSignedSceneAvBeat('ch6-dive');
    markMilestone('story:dive:waterline-entered');
    markMilestone('story:dive:keel-sonar-revealed');

    tickSignedSceneAvRuntime(0.1);

    expect(getSignedSceneAvDebugSnapshot().activatedAnchorIds).toEqual([
      'anc.dive.waterline',
      'anc.dive.keel-revealed'
    ]);

    markMilestone('story:dive:oxygen-75');
    tickSignedSceneAvRuntime(0.1);
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.dive.keel-revealed',
      activatedAnchorIds: [
        'anc.dive.waterline',
        'anc.dive.keel-revealed',
        'anc.dive.oxygen-authored'
      ]
    });
  });

  it('hydrates the completed physical dive rail without inventing an unobserved oxygen beat', () => {
    enterSignedSceneAvBeat('ch6-dive');
    markMilestone('story:dive:waterline-entered');
    markMilestone('story:dive:keel-sonar-revealed');
    markMilestone('story:item:kestrel-keel-memory:acquired');
    markMilestone('story:dive:surfaced-with-keel');
    markMilestone('story:item:kestrel-keel-memory:banked');

    tickSignedSceneAvRuntime(0.1);

    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.dive.shore-bank',
      activatedAnchorIds: [
        'anc.dive.waterline',
        'anc.dive.keel-revealed',
        'anc.dive.keel-freed',
        'anc.dive.surface',
        'anc.dive.shore-bank'
      ]
    });
    expect(getSignedSceneAvDebugSnapshot().activationHistoryAnchorIds).not.toContain(
      'anc.dive.oxygen-authored'
    );
  });

  it('records a late oxygen receipt without rewinding the newer physical presentation', () => {
    enterSignedSceneAvBeat('ch6-dive');
    emitEmergentStoryEvent({
      id: 'test:dive-waterline-before-late-oxygen',
      type: 'submersion_changed',
      payload: { submerged: true, amount: 0.8 }
    });
    emitEmergentStoryEvent({
      id: 'test:dive-keel-revealed-before-late-oxygen',
      type: 'keel_revealed',
      payload: { source: 'repaired-maw-sonar', structuralPinVisible: true, distance: 4 }
    });
    const beforeOxygen = getSignedSceneAvDebugSnapshot();

    emitEmergentStoryEvent({
      id: 'test:dive-late-oxygen',
      type: 'oxygen_threshold',
      payload: { oxygen: 74, threshold: 75, direction: 'falling' }
    });
    const afterOxygen = getSignedSceneAvDebugSnapshot();

    expect(afterOxygen).toMatchObject({
      anchorId: beforeOxygen.anchorId,
      activationSource: beforeOxygen.activationSource,
      shot: beforeOxygen.shot,
      postFx: beforeOxygen.postFx,
      activatedAnchorIds: [
        'anc.dive.waterline',
        'anc.dive.keel-revealed',
        'anc.dive.oxygen-authored'
      ]
    });
    expect(afterOxygen.activationSequence).toBe(beforeOxygen.activationSequence + 1);

    emitEmergentStoryEvent({
      id: 'test:dive-late-oxygen-duplicate',
      type: 'oxygen_threshold',
      payload: { oxygen: 74, threshold: 75, direction: 'falling' }
    });
    expect(getSignedSceneAvDebugSnapshot().activationSequence).toBe(afterOxygen.activationSequence);
  });

  it('ignores another actor\'s oxygen receipt on the local signed AV rail', () => {
    enterSignedSceneAvBeat('ch6-dive');
    emitEmergentStoryEvent({
      id: 'test:dive-local-waterline',
      type: 'submersion_changed',
      payload: { submerged: true, amount: 0.8 }
    });
    emitEmergentStoryEvent({
      id: 'test:dive-remote-oxygen',
      type: 'oxygen_threshold',
      actorId: 'remote-diver',
      payload: { oxygen: 74, threshold: 75, direction: 'falling' }
    });

    expect(getSignedSceneAvDebugSnapshot().activatedAnchorIds).toEqual([
      'anc.dive.waterline'
    ]);
  });

  it('does not seize the vehicle lens rig and optional anchors never gate handback', () => {
    enterSignedSceneAvBeat('ch8-crossing');
    emitEmergentStoryEvent({
      id: 'test:tidegarden-target',
      type: 'system_body_targeted',
      payload: {
        worldId: '-1,-1:p1',
        seed: 1600321158,
        profileId: 'story:tidegarden',
        profileVersion: 1,
        profileHash: 'pf1-eeef3b78',
        archetype: 'verdant'
      }
    });
    const vehicle = getSignedSceneAvDebugSnapshot();
    expect(vehicle.anchorId).toBe('anc.crossing.sibling-targeted');
    expect(vehicle.shot?.cameraAuthority).toBe('lens-rig');
    expect(vehicle.shot?.lens.appliedFovDeg).toBeNull();

    resetSignedSceneAvRuntime('deep-link');
    enterSignedSceneAvBeat('ch9-hearth');
    expect(activateSignedSceneSemanticEvent('ev.hearth.origin-framed:optional')).toBe(false);
    emitEmergentStoryEvent({
      id: 'test:hearth-safe-rest',
      type: 'safe_rest_completed',
      payload: { worldId: '-1,-1:p1', shelterId: 'test-shelter' }
    });
    expect(getSignedSceneAvDebugSnapshot().activatedAnchorIds).toEqual([
      'anc.hearth.ecology-night',
      'anc.hearth.safe-rest'
    ]);
    emitEmergentStoryEvent({
      id: 'test:hearth-handoff',
      type: 'two_world_story_handoff',
      payload: { originWorldId: '-1,-1', siblingWorldId: '-1,-1:p1' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.hearth.freeplay-handback',
      activatedAnchorIds: [
        'anc.hearth.ecology-night',
        'anc.hearth.safe-rest',
        'anc.hearth.freeplay-handback'
      ]
    });
  });

  it('carries only the signed approach shot into landfall until touchdown', () => {
    enterSignedSceneAvBeat('ch8-crossing');
    emitEmergentStoryEvent({
      id: 'test:tidegarden-approach-target',
      type: 'system_body_targeted',
      payload: {
        worldId: '-1,-1:p1',
        seed: 1600321158,
        profileId: 'story:tidegarden',
        profileVersion: 1,
        profileHash: 'pf1-eeef3b78',
        archetype: 'verdant'
      }
    });
    expect(activateSignedSceneSemanticEvent('ev.crossing.world-owner-transferred')).toBe(true);
    expect(activateSignedSceneSemanticEvent('ev.crossing.approach-established')).toBe(true);
    const crossingApproach = getSignedSceneAvDebugSnapshot();
    expect(crossingApproach).toMatchObject({
      beat: 'ch8-crossing',
      anchorId: 'anc.crossing.approach',
      shot: { id: 'cin.landfall.01-read-the-ground' },
      score: { cueRefs: ['sc.crossing.distance'] },
      postFx: { activeEffectIds: ['fx.landfall.01-read-the-ground'] }
    });

    enterSignedSceneAvBeat('ch8-landfall');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      beat: 'ch8-landfall',
      anchorId: 'anc.crossing.approach',
      activatedAnchorIds: [],
      shot: { id: 'cin.landfall.01-read-the-ground' },
      score: {
        cueRefs: ['sc.crossing.distance'],
        intensity: crossingApproach.score.intensity
      },
      postFx: { activeEffectIds: ['fx.landfall.01-read-the-ground'] }
    });

    emitEmergentStoryEvent({
      id: 'test:tidegarden-touchdown',
      type: 'planet_arrived',
      worldId: '-1,-1:p1',
      payload: { worldId: '-1,-1:p1' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      beat: 'ch8-landfall',
      anchorId: 'anc.landfall.touchdown',
      activatedAnchorIds: ['anc.landfall.touchdown'],
      shot: { id: 'cin.landfall.02-weight-on-another-world' },
      score: { cueRefs: ['sc.landfall.world-first'] },
      postFx: { activeEffectIds: ['fx.landfall.02-weight-on-another-world'] }
    });
  });

  it('clears an outgoing shot that has no signed incoming-beat continuity', () => {
    enterSignedSceneAvBeat('ch8-crossing');
    emitEmergentStoryEvent({
      id: 'test:tidegarden-target-without-approach',
      type: 'system_body_targeted',
      payload: {
        worldId: '-1,-1:p1',
        seed: 1600321158,
        profileId: 'story:tidegarden',
        profileVersion: 1,
        profileHash: 'pf1-eeef3b78',
        archetype: 'verdant'
      }
    });
    expect(getSignedSceneAvDebugSnapshot().shot?.id).toBe('cin.crossing.03-another-world-ahead');

    enterSignedSceneAvBeat('ch8-landfall');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      beat: 'ch8-landfall',
      anchorId: null,
      shot: null,
      activationHistoryAnchorIds: ['anc.crossing.sibling-targeted'],
      activatedAnchorIds: [],
      postFx: { activeEffectIds: [] },
      lastResetReason: 'beat-exit'
    });
  });

  it('keeps refusal availability and the A4 pond blocked without physical precursors', () => {
    enterSignedSceneAvBeat('ch4-defy');
    emitEmergentStoryEvent({
      id: 'test:refusal-without-tool-precursor',
      type: 'refusal_committed',
      payload: { target: 'hero_tree' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.defy.tree-order',
      activatedAnchorIds: ['anc.defy.tree-order']
    });
    emitEmergentStoryEvent({
      id: 'test:protected-tree-tool-refused',
      type: 'protected_tree_tool_refused',
      payload: { target: 'hero_tree', toolId: 'faulty_maw', targetIntegrity: 'unchanged' }
    });
    emitEmergentStoryEvent({
      id: 'test:tree-refusal-available',
      type: 'tree_refusal_available',
      payload: { target: 'hero_tree', verb: 'refuse.' }
    });
    emitEmergentStoryEvent({
      id: 'test:refusal-after-tool-precursor',
      type: 'refusal_committed',
      payload: { target: 'hero_tree' }
    });
    expect(getSignedSceneAvDebugSnapshot().activatedAnchorIds).toEqual([
      'anc.defy.tree-order',
      'anc.defy.tool-refusal',
      'anc.defy.refuse-available',
      'anc.defy.no-committed'
    ]);

    enterSignedSceneAvBeat('a4-exhale');
    emitEmergentStoryEvent({
      id: 'test:a4-authority',
      type: 'reality_stage_committed',
      payload: { stage: 'alive', awakening: 'a4' }
    });
    emitEmergentStoryEvent({
      id: 'test:a4-pack-without-visible-pond',
      type: 'field_pack_dropped',
      payload: {
        source: 'w7744',
        dryGroundValidated: true,
        vegetationContact: 'branch',
        workerGrounded: true
      }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.a4.life-front',
      activatedAnchorIds: ['anc.a4.held-stillness', 'anc.a4.life-front']
    });
    emitEmergentStoryEvent({
      id: 'test:a4-pond-visible',
      type: 'a4_pond_response_visible',
      payload: { response: 'structural-ripple', visible: true }
    });
    emitEmergentStoryEvent({
      id: 'test:a4-herd-visible',
      type: 'a4_herd_route_visible',
      payload: { grounded: true, visibleAgents: 5, routeDistance: 2 }
    });
    emitEmergentStoryEvent({
      id: 'test:a4-worker-flight',
      type: 'a4_w7744_fault_recorded',
      payload: { grounded: true, travelledDistance: 1 }
    });
    emitEmergentStoryEvent({
      id: 'test:a4-pack-after-branch',
      type: 'field_pack_dropped',
      payload: {
        source: 'w7744',
        dryGroundValidated: true,
        vegetationContact: 'branch',
        workerGrounded: true
      }
    });
    expect(getSignedSceneAvDebugSnapshot().activatedAnchorIds).toEqual([
      'anc.a4.held-stillness',
      'anc.a4.life-front',
      'anc.a4.pond-wakes',
      'anc.a4.herd-crest',
      'anc.a4.w7744-flight',
      'anc.a4.pack-torn'
    ]);
  });

  it('requires ritual, chosen direction, physical resonance and sonar reveal in order', () => {
    enterSignedSceneAvBeat('ch5-maw');
    emitEmergentStoryEvent({
      id: 'test:maw-kit-for-causal-chain',
      type: 'maw_repair_kit_acquired',
      payload: { itemId: 'maw_repair_kit' }
    });
    emitEmergentStoryEvent({
      id: 'test:maw-committed-too-early',
      type: 'maw_repaired',
      payload: { toolId: 'iron_maw' }
    });
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.maw.kit-acquired');
    emitEmergentStoryEvent({
      id: 'test:maw-ritual-begun',
      type: 'maw_repair_begun',
      payload: { toolId: 'faulty_maw', ritualSeconds: 8 }
    });
    emitEmergentStoryEvent({
      id: 'test:maw-ritual-cancelled',
      type: 'maw_repair_cancelled',
      payload: { toolId: 'faulty_maw', attendedSeconds: 2.4 }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.maw.kit-acquired',
      shot: null,
      activatedAnchorIds: [
        'anc.a4.handback',
        'anc.maw.pack-attended',
        'anc.maw.kit-acquired'
      ]
    });
    emitEmergentStoryEvent({
      id: 'test:maw-ritual-restarted',
      type: 'maw_repair_begun',
      payload: { toolId: 'faulty_maw', ritualSeconds: 8 }
    });
    emitEmergentStoryEvent({
      id: 'test:maw-committed-after-ritual',
      type: 'maw_repaired',
      payload: { toolId: 'iron_maw' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.maw.repair-committed',
      score: { hit: 'bloom' }
    });
    emitEmergentStoryEvent({
      id: 'test:maw-direction',
      type: 'maw_direction_resolved',
      payload: { targetKind: 'unassigned', choice: 'lowered-and-listened' }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.maw.direction-handback',
      score: { hit: null }
    });
    emitEmergentStoryEvent({
      id: 'test:maw-pond-response',
      type: 'keel_resonance_detected',
      payload: {
        source: 'kestrel_keel_memory',
        response: 'structural-ripple',
        visible: true
      }
    });
    const completedMaw = getSignedSceneAvDebugSnapshot();
    expect(completedMaw.anchorId).toBe('anc.maw.pond-resonance');
    expect(completedMaw.activationHistoryAnchorIds.filter(
      anchorId => anchorId === 'anc.maw.repair-begun'
    )).toEqual(['anc.maw.repair-begun']);

    enterSignedSceneAvBeat('ch6-dive');
    emitEmergentStoryEvent({
      id: 'test:dive-waterline-chain',
      type: 'submersion_changed',
      payload: { submerged: true, amount: 0.8 }
    });
    emitEmergentStoryEvent({
      id: 'test:dive-keel-reveal-before-oxygen-threshold',
      type: 'keel_revealed',
      payload: { source: 'repaired-maw-sonar', structuralPinVisible: true, distance: 4 }
    });
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.dive.keel-revealed');
    emitEmergentStoryEvent({
      id: 'test:dive-oxygen-chain',
      type: 'oxygen_threshold',
      payload: { oxygen: 74, threshold: 75, direction: 'falling' }
    });
    emitEmergentStoryEvent({
      id: 'test:dive-keel-revealed',
      type: 'keel_revealed',
      payload: { source: 'repaired-maw-sonar', structuralPinVisible: true, distance: 4 }
    });
    emitEmergentStoryEvent({
      id: 'test:dive-keel-freed',
      type: 'keel_memory_acquired',
      payload: { componentId: 'kestrel_keel_memory' }
    });
    expect(getSignedSceneAvDebugSnapshot().activatedAnchorIds).toEqual([
      'anc.dive.waterline',
      'anc.dive.keel-revealed',
      'anc.dive.oxygen-authored',
      'anc.dive.keel-freed'
    ]);
  });

  it('wires calibration and foundation receipts after their ordered predecessor proofs', () => {
    enterSignedSceneAvBeat('ch7-reconstruct');
    expect(activateSignedSceneSemanticEvent('ev.reconstruct.relationships-diagnosed')).toBe(true);
    for (const [from, to] of [
      ['wrecked', 'bench_online'],
      ['bench_online', 'frame_restored'],
      ['frame_restored', 'hull_sealed'],
      ['hull_sealed', 'lift_online']
    ] as const) {
      emitEmergentStoryEvent({
        id: `test:repair:${to}`,
        type: 'ship_repair_stage',
        payload: { from, to }
      });
    }
    expect(activateSignedSceneSemanticEvent('ev.reconstruct.first-legal-hover')).toBe(true);
    emitEmergentStoryEvent({
      id: 'test:repair:flight-ready',
      type: 'ship_repair_stage',
      payload: { from: 'lift_online', to: 'flight_ready' }
    });
    expect(getSignedSceneAvDebugSnapshot().anchorId).toBe('anc.reconstruct.route-online');
    expect(activateSignedSceneSemanticEvent('ev.reconstruct.calibration-completed')).toBe(true);
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.reconstruct.calibration',
      activatedAnchorIds: [
        'anc.reconstruct.diagnosis',
        'anc.reconstruct.bench-online',
        'anc.reconstruct.frame-restored',
        'anc.reconstruct.hull-sealed',
        'anc.reconstruct.lift-online',
        'anc.reconstruct.first-hover',
        'anc.reconstruct.route-online',
        'anc.reconstruct.calibration'
      ]
    });

    enterSignedSceneAvBeat('ch9-settle');
    emitEmergentStoryEvent({
      id: 'test:settlement-scanner-physical',
      type: 'settlement_scanner_overload',
      payload: { worldId: '-1,-1:p1', visibleSignalCount: 8, relationshipKinds: 3 }
    });
    emitEmergentStoryEvent({
      id: 'test:settlement-relationship',
      type: 'ecology_relationship_observed',
      payload: { worldId: '-1,-1:p1', relationshipId: 'bank-roots' }
    });
    emitEmergentStoryEvent({
      id: 'test:settlement-site-physical',
      type: 'settlement_site_chosen',
      payload: {
        worldId: '-1,-1:p1',
        cell: [0, 5, 0],
        supportCell: [0, 4, 0],
        up: [0, 1, 0]
      }
    });
    emitEmergentStoryEvent({
      id: 'test:settlement-foundation',
      type: 'settlement_foundation_placed',
      payload: {
        transactionEventId: 'structure-event-1',
        cell: [0, 5, 0],
        face: 3,
        material: 'wood'
      }
    });
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      anchorId: 'anc.settle.first-foundation',
      activatedAnchorIds: [
        'anc.settle.scanner-overload',
        'anc.settle.relationship-attended',
        'anc.settle.site-chosen',
        'anc.settle.first-foundation'
      ]
    });
  });

  it('keeps unique run activation history through quit and completion, then clears it for sandbox', () => {
    enterSignedSceneAvBeat('ch9-settle');
    emitEmergentStoryEvent({
      id: 'test:settlement-scanner-before-quit',
      type: 'settlement_scanner_overload',
      payload: { worldId: '-1,-1:p1', visibleSignalCount: 8, relationshipKinds: 3 }
    });
    resetSignedSceneAvRuntime('quit');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      active: false,
      beat: null,
      anchorId: null,
      shot: null,
      activationHistoryAnchorIds: ['anc.settle.scanner-overload'],
      activatedAnchorIds: [],
      postFx: { activeEffectIds: [], supportMix: 0 },
      lastResetReason: 'quit'
    });

    enterSignedSceneAvBeat('ch9-hearth');
    emitEmergentStoryEvent({
      id: 'test:hearth-safe-rest-before-completion',
      type: 'safe_rest_completed',
      payload: { worldId: '-1,-1:p1', shelterId: 'test-shelter' }
    });
    emitEmergentStoryEvent({
      id: 'test:hearth-handoff-before-completion',
      type: 'two_world_story_handoff',
      payload: { originWorldId: '-1,-1', siblingWorldId: '-1,-1:p1' }
    });
    enterSignedSceneAvBeat(null, 'completion');
    expect(getSignedSceneAvDebugSnapshot()).toMatchObject({
      active: false,
      activatedAnchorIds: [],
      activationHistoryAnchorIds: [
        'anc.settle.scanner-overload',
        'anc.hearth.ecology-night',
        'anc.hearth.safe-rest',
        'anc.hearth.freeplay-handback'
      ],
      postFx: { supportMix: 0 },
      lastResetReason: 'completion'
    });

    resetSignedSceneAvRuntime('sandbox');
    expect(getSignedSceneAvDebugSnapshot().activationHistoryAnchorIds).toEqual([]);
  });
});
