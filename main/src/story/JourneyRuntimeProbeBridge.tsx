import React, { useEffect } from 'react';
import {
  getInteractionProbeSnapshot
} from '../game/systems/interactionSystem.ts';
import { getLocalActorId } from '../game/playerActors.ts';
import { getShipRestorationSnapshot } from '../game/systems/shipRestoration.ts';
import { getProgressionSnapshot } from '../game/systems/progressionSystem.ts';
import {
  clearStoryInteractionTrace,
  getStoryInteractionResolutionSnapshot,
  getStoryInteractionTrace
} from './storyInteractions.ts';
import { getStoryStateSnapshot, getWorkerName } from './storyState.ts';
import {
  getActiveGuidedStoryObjective,
  getGuidedStoryObjectiveHealth,
  getGuidedStoryObjectiveVersion
} from './ux/objectiveDirector.ts';
import { getJourneyEntitySnapshot } from './journeyRuntime.ts';
import {
  getJourneyInputSnapshot,
  recordJourneyGameplayHotkeyBoundary
} from './journeyInputRuntime.ts';
import {
  getJourneyProbePreparationSnapshot,
  recordJourneyProbePreparation,
  requestJourneyProbePreparation,
  type JourneyProbePreparationRecord
} from './journeyProbePreparation.ts';
import { hifiWreckHandle } from './world/hifiWreck.ts';
import {
  setCinematicGazeIntent,
  setCinematicLookTarget,
  setCinematicLookWeight
} from './cinematicLook.ts';
import { getPlayerWorldPosition } from '../state/playerFrame.ts';
import { getSpaceFlightSnapshot } from '../state/spaceFlight.ts';
import { getSystemFlightSnapshot } from '../state/systemFlight.ts';
import { getSignedSceneAvDebugSnapshot } from './signedSceneAvRuntime.ts';

interface JourneyProbeBridge {
  snapshot: () => Record<string, unknown>;
  getSnapshot: () => Record<string, unknown>;
  clearInteractionTrace: () => void;
  prepareScenario: (scenarioId: string) => JourneyProbePreparationRecord;
  releaseScenario: (scenarioId?: string) => void;
}

declare global {
  interface Window {
    __paravoxiaJourneyProbe?: JourneyProbeBridge;
  }
}

function probeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('journeyprobe') === '1' || params.get('chapterjourney') === '1';
}

const PREPARATION_BEATS: Readonly<Record<string, string>> = Object.freeze({
  'input:voyage-worker-name': 'voyage',
  'interaction:persistent-scar-arbitration': 'ch7-reconstruct'
});

function deniedPreparation(
  scenarioId: string,
  storyBeat: string | null,
  reason: string
): JourneyProbePreparationRecord {
  return recordJourneyProbePreparation(scenarioId, storyBeat, {
    status: 'denied',
    handlerId: 'journey-runtime-probe-bridge',
    reason
  });
}

/**
 * Direct-entry assistance is deliberately narrower than the read-only probe:
 * the caller must identify the exact scenario and noncertifying lane in the
 * URL, and the live story beat must agree. Ordinary play and continuous proof
 * therefore cannot acquire reconstructed prerequisites through this seam.
 */
function preparationIdentityReason(scenarioId: string, storyBeat: string | null): string | null {
  if (typeof window === 'undefined') return 'browser-window-unavailable';
  const expectedBeat = PREPARATION_BEATS[scenarioId];
  if (!expectedBeat) return 'scenario-not-whitelisted';
  const params = new URLSearchParams(window.location.search);
  if (params.get('journeyprobe') !== '1' && params.get('chapterjourney') !== '1') {
    return 'journey-probe-query-missing';
  }
  if (params.get('debug') !== '1') return 'debug-query-missing';
  if (params.get('journeylane') !== 'direct-entry') return 'lane-is-not-direct-entry';
  if (params.get('journeyscenario') !== scenarioId) return 'scenario-query-mismatch';
  if (params.get('story') !== expectedBeat) return 'story-query-mismatch';
  if (storyBeat !== expectedBeat) return 'live-story-beat-mismatch';
  return null;
}

function elementSnapshot(element: Element | null): Record<string, unknown> | null {
  if (!(element instanceof HTMLElement)) return null;
  const editable = element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element.isContentEditable;
  return {
    tag: element.tagName.toLowerCase(),
    id: element.id || null,
    name: element.getAttribute('name'),
    type: element instanceof HTMLInputElement ? element.type : null,
    editable,
    voyageWorkerNameInput: element.dataset.voyageWorkerNameInput === 'true',
    value: element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
      ? element.value
      : null
  };
}

function visiblePromptSnapshots(): Record<string, unknown>[] {
  return [...document.querySelectorAll<HTMLElement>('[data-interaction-prompt="primary"]')]
    .filter(element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity) > 0
        && rect.width > 0
        && rect.height > 0;
    })
    .map(element => {
      const rect = element.getBoundingClientRect();
      return {
        id: element.dataset.interactionId ?? null,
        owner: element.dataset.interactionOwner ?? null,
        scope: element.dataset.interactionScope ?? null,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        }
      };
    });
}

function buildSnapshot(): Record<string, unknown> {
  const story = getStoryStateSnapshot();
  const objective = getActiveGuidedStoryObjective();
  const entityRuntime = getJourneyEntitySnapshot();
  const resolution = getStoryInteractionResolutionSnapshot();
  const trace = getStoryInteractionTrace();
  const prompts = visiblePromptSnapshots();
  const input = getJourneyInputSnapshot();
  const workerName = getWorkerName();
  const localActorId = getLocalActorId();
  const progression = getProgressionSnapshot();
  const localProgression = progression[localActorId] ?? null;
  const spaceFlight = getSpaceFlightSnapshot();
  const systemFlight = getSystemFlightSnapshot();
  const shipRestoration = getShipRestorationSnapshot();
  const signedSceneAv = getSignedSceneAvDebugSnapshot();
  return {
    schema: 'paravoxia.journeyRuntimeSnapshot.v1',
    sampledAt: Date.now(),
    story: {
      active: story.active,
      chapter: story.chapter,
      beat: story.beat,
      runId: story.runId
    },
    objective: objective ? {
      ...objective,
      workOrder: [...objective.workOrder],
      health: getGuidedStoryObjectiveHealth(),
      revision: getGuidedStoryObjectiveVersion()
    } : {
      id: null,
      health: getGuidedStoryObjectiveHealth(),
      revision: getGuidedStoryObjectiveVersion()
    },
    interaction: {
      ...resolution,
      published: getInteractionProbeSnapshot(),
      trace,
      effects: trace.entries,
      prompts,
      visiblePromptCount: prompts.length
    },
    entities: entityRuntime.entities,
    entityEvents: entityRuntime.events,
    entityRevision: entityRuntime.revision,
    receipts: progression,
    state: {
      localActor: {
        id: localActorId,
        era: localProgression?.era ?? null,
        milestones: [...(localProgression?.milestones ?? [])]
      },
      spaceFlight: {
        ...spaceFlight,
        destination: spaceFlight.destination ? { ...spaceFlight.destination } : null,
        target: spaceFlight.target ? { ...spaceFlight.target } : null
      },
      systemFlight: {
        ...systemFlight,
        pose: {
          position: [...systemFlight.pose.position],
          velocity: [...systemFlight.pose.velocity],
          quaternion: [...systemFlight.pose.quaternion]
        },
        // Deep-copied per kind. An spaceStation target carries an address like a
        // planet does but is not one, so the old "planet or else a coordinate"
        // split would have handed the probe an undefined coordinate.
        target: systemFlight.target
          ? systemFlight.target.kind === 'star_system'
            ? {
              ...systemFlight.target,
              coordinate: { ...systemFlight.target.coordinate }
            }
            : {
              ...systemFlight.target,
              address: {
                ...systemFlight.target.address,
                system: { ...systemFlight.target.address.system }
              }
            }
          : null,
        renderOrigin: [...systemFlight.renderOrigin]
      },
      shipRestoration: {
        ...shipRestoration,
        parkedPose: shipRestoration.parkedPose ? {
          position: [...shipRestoration.parkedPose.position],
          quaternion: [...shipRestoration.parkedPose.quaternion]
        } : null,
        systemPose: shipRestoration.systemPose ? {
          position: [...shipRestoration.systemPose.position],
          velocity: [...shipRestoration.systemPose.velocity],
          quaternion: [...shipRestoration.systemPose.quaternion]
        } : null,
        repairHistory: shipRestoration.repairHistory.map(commit => ({ ...commit }))
      },
      signedSceneAv: {
        active: signedSceneAv.active,
        suspended: signedSceneAv.suspended,
        beat: signedSceneAv.beat,
        anchorId: signedSceneAv.anchorId,
        anchorEvent: signedSceneAv.anchorEvent,
        activationSequence: signedSceneAv.activationSequence,
        activationHistoryAnchorIds: [...signedSceneAv.activationHistoryAnchorIds]
      },
      voyage: {
        'worker-name': workerName
      }
    },
    input: {
      ...input,
      workerName,
      activeElement: elementSnapshot(document.activeElement)
    },
    preparation: getJourneyProbePreparationSnapshot()
  };
}

/**
 * Query-gated bridge for real-browser journey evidence. Snapshot reads are
 * passive. Its two whitelisted direct-entry preparations are separately gated,
 * explicitly receipted, and noncertifying; ordinary play mounts no visible
 * harness and cannot invoke them.
 */
const JourneyRuntimeProbeBridge: React.FC = () => {
  useEffect(() => {
    if (!probeEnabled()) return undefined;
    let diagnosticGazeOwned = false;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const targetEditable = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLElement && target.isContentEditable;
      recordJourneyGameplayHotkeyBoundary(event.code, targetEditable);
    };
    const releaseScenario = (scenarioId?: string) => {
      if (!diagnosticGazeOwned
        || scenarioId && scenarioId !== 'interaction:persistent-scar-arbitration') return;
      setCinematicLookWeight(0);
      setCinematicLookTarget(null);
      setCinematicGazeIntent(null);
      diagnosticGazeOwned = false;
    };
    const prepareScenario = (scenarioId: string): JourneyProbePreparationRecord => {
      const story = getStoryStateSnapshot();
      const reason = preparationIdentityReason(scenarioId, story.beat);
      if (reason) return deniedPreparation(scenarioId, story.beat, reason);

      if (scenarioId === 'input:voyage-worker-name') {
        return requestJourneyProbePreparation(scenarioId, story.beat);
      }

      const target = hifiWreckHandle.diagnosisTarget;
      if (!target || !hifiWreckHandle.converted) {
        return recordJourneyProbePreparation(scenarioId, story.beat, {
          status: 'waiting',
          handlerId: 'wreck-diagnostic-gaze',
          reason: 'wreck-diagnosis-target-not-ready'
        });
      }
      const player = getPlayerWorldPosition();
      setCinematicGazeIntent(null);
      setCinematicLookTarget(target);
      setCinematicLookWeight(1);
      diagnosticGazeOwned = true;
      return recordJourneyProbePreparation(scenarioId, story.beat, {
        status: 'prepared',
        handlerId: 'wreck-diagnostic-gaze',
        evidence: {
          assistance: 'gaze-only',
          movedPlayer: false,
          playerPosition: player.toArray(),
          targetPosition: target.toArray(),
          distance: Math.round(player.distanceTo(target) * 1000) / 1000
        }
      });
    };
    const bridge: JourneyProbeBridge = {
      snapshot: buildSnapshot,
      getSnapshot: buildSnapshot,
      clearInteractionTrace: clearStoryInteractionTrace,
      prepareScenario,
      releaseScenario
    };
    window.__paravoxiaJourneyProbe = bridge;
    window.addEventListener('keydown', onKeyDown);
    return () => {
      releaseScenario();
      window.removeEventListener('keydown', onKeyDown);
      if (window.__paravoxiaJourneyProbe === bridge) {
        delete window.__paravoxiaJourneyProbe;
      }
    };
  }, []);
  return null;
};

export default JourneyRuntimeProbeBridge;
