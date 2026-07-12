export const DEFAULT_SYSTEM_ATMOSPHERE_ENVELOPE = 135;

export interface SystemTravelGateState {
  readonly lockedWorldId: string | null;
  readonly preparedLockWorldId: string | null;
  readonly activatedLockWorldId: string | null;
  readonly preparedWorldIds: readonly string[];
}

export interface SystemTravelGateTarget {
  readonly worldId: string;
  /** Center-to-camera distance in canonical system units. */
  readonly distance: number;
  readonly nominalFaceRadius: number;
  readonly ready: boolean;
}

export interface SystemTravelGateActions {
  readonly commit: boolean;
  readonly cancel: boolean;
  readonly prepare: boolean;
  readonly activate: boolean;
}

export interface SystemTravelGateTransition {
  readonly state: SystemTravelGateState;
  readonly actions: SystemTravelGateActions;
}

const NO_ACTIONS: SystemTravelGateActions = Object.freeze({
  commit: false,
  cancel: false,
  prepare: false,
  activate: false
});

export function createSystemTravelGateState(): SystemTravelGateState {
  return {
    lockedWorldId: null,
    preparedLockWorldId: null,
    activatedLockWorldId: null,
    preparedWorldIds: []
  };
}

/** Release a tentatively consumed activation so a rejected/aborted handoff retries. */
export function rejectSystemTravelActivation(
  state: SystemTravelGateState,
  worldId: string
): SystemTravelGateState {
  if (state.activatedLockWorldId !== worldId) return state;
  return {
    ...state,
    lockedWorldId: null,
    preparedLockWorldId: null,
    activatedLockWorldId: null
  };
}

/** Allow a failed async preparation to retry without losing the current aim lock. */
export function retrySystemTravelPreparation(
  state: SystemTravelGateState,
  worldId: string
): SystemTravelGateState {
  if (state.preparedLockWorldId !== worldId) return state;
  return { ...state, preparedLockWorldId: null };
}

export function isWithinSystemActivationEnvelope(
  distance: number,
  nominalFaceRadius: number,
  atmosphereEnvelope = DEFAULT_SYSTEM_ATMOSPHERE_ENVELOPE
): boolean {
  return Number.isFinite(distance)
    && Number.isFinite(nominalFaceRadius)
    && Number.isFinite(atmosphereEnvelope)
    && distance >= 0
    && nominalFaceRadius >= 0
    && atmosphereEnvelope >= 0
    && distance <= nominalFaceRadius + atmosphereEnvelope;
}

/**
 * Resolve boundary actions for one aimed body. The caller can avoid invoking this
 * on steady frames; all histories only allocate when a boundary actually changes.
 */
export function transitionSystemTravelGate(
  state: SystemTravelGateState,
  target: SystemTravelGateTarget | null,
  atmosphereEnvelope = DEFAULT_SYSTEM_ATMOSPHERE_ENVELOPE
): SystemTravelGateTransition {
  if (!target) {
    if (state.lockedWorldId === null) return { state, actions: NO_ACTIONS };
    return {
      state: {
        ...state,
        lockedWorldId: null,
        preparedLockWorldId: null,
        activatedLockWorldId: null
      },
      actions: { ...NO_ACTIONS, cancel: true }
    };
  }

  const commit = state.lockedWorldId !== target.worldId;
  const preparedBefore = state.preparedWorldIds.includes(target.worldId);
  const prepare = commit
    ? !preparedBefore || !target.ready
    : state.preparedLockWorldId !== target.worldId && !target.ready;
  const activate = target.ready
    && (commit || state.activatedLockWorldId !== target.worldId)
    && isWithinSystemActivationEnvelope(
      target.distance,
      target.nominalFaceRadius,
      atmosphereEnvelope
    );

  if (!commit && !prepare && !activate) return { state, actions: NO_ACTIONS };

  return {
    state: {
      lockedWorldId: target.worldId,
      preparedLockWorldId: prepare
        ? target.worldId
        : commit
          ? null
          : state.preparedLockWorldId,
      activatedLockWorldId: activate
        ? target.worldId
        : commit
          ? null
          : state.activatedLockWorldId,
      preparedWorldIds: prepare && !preparedBefore
        ? [...state.preparedWorldIds, target.worldId]
        : state.preparedWorldIds
    },
    actions: {
      commit,
      cancel: false,
      prepare,
      activate
    }
  };
}
