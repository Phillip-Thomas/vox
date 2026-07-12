import { musicUnit, SALT_ARRANGE, SALT_ARRANGE_PICK } from './seededMusic.ts';
import {
  ARRANGEMENT_LEVELS,
  BED_TO_BUILD_ENERGY_BOOST,
  BED_TO_BUILD_P_BASE,
  BED_TO_REST_P_PER_PHRASE,
  BLOOM_TO_EBB_P,
  DWELL_MAX,
  DWELL_MIN,
  EBB_TO_REST_P,
  ERA_MATERIAL,
  REST_LIFT_ENERGY_BOOST,
  REST_LIFT_WONDER_BOOST,
  REST_TO_BED_P_BASE,
  type ArrangementStateName,
  type BedLayerLevels
} from './tuning.ts';

// --- Arrangement (§8.3) — the state machine that breathes ---------------------------------------
//
//   REST(quiet-bed floor) ⇄ BED ⇄ BUILD → BLOOM → EBB → (REST|BED)
//
// One transition decision per PHRASE. Owner ruling #4: there is NO full-silence
// state — REST is the floor (tuned sub + one soft pad voice), and the sub-swell
// is the gesture that lifts out of it. BUILD is exactly one phrase and ALWAYS
// lands its bloom on the next phrase boundary (the ODESZA law). Era caps the
// reachable states: `bare` can only REST/BED; the full build→bloom gesture
// needs era ≥ material. All draws are seeded on (planetSeed, phraseIndex).

export interface ArrangementState {
  name: ArrangementStateName;
  /** Phrases spent in the current state (including the one about to play). */
  dwell: number;
}

export interface ArrangementInputs {
  energy: number;
  tension: number;
  wonder: number;
  era: number;
  /** True while the reality stage is `bare` (only REST/BED reachable). */
  bare: boolean;
  /** Extra REST weighting from the scene policy (deepSpace, storyTerminal). */
  restBoost: number;
  /** Scene/warp forces a BUILD phrase (launch entry, warp). */
  forceBuild: boolean;
  /** Warp just ended — EBB on the next boundary (§8.4). */
  forceEbb: boolean;
}

export function createArrangement(): ArrangementState {
  return { name: 'BED', dwell: 1 };
}

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

function enter(state: ArrangementState, name: ArrangementStateName): ArrangementState {
  state.name = name;
  state.dwell = 1;
  return state;
}

/**
 * Advance the machine at a phrase boundary. Mutates `state`; returns it.
 * `phraseIndex` salts the seeded draws (reproducible given the same inputs).
 */
export function advanceArrangementPhrase(
  state: ArrangementState,
  planetSeed: number,
  phraseIndex: number,
  inputs: ArrangementInputs
): ArrangementState {
  const draw = musicUnit(planetSeed, SALT_ARRANGE, phraseIndex);
  const pick = musicUnit(planetSeed, SALT_ARRANGE_PICK, phraseIndex);
  const buildAllowed = !inputs.bare && inputs.era >= ERA_MATERIAL;

  // Era cap: `bare` collapses the arc to the floor states.
  if (inputs.bare && state.name !== 'REST' && state.name !== 'BED') {
    return enter(state, state.name === 'BLOOM' || state.name === 'BUILD' ? 'BED' : 'REST');
  }

  // Forced gestures take priority (warp → BUILD; warp exit → EBB).
  if (inputs.forceBuild && buildAllowed && state.name !== 'BUILD' && state.name !== 'BLOOM') {
    return enter(state, 'BUILD');
  }
  if (inputs.forceEbb && (state.name === 'BUILD' || state.name === 'BLOOM')) {
    return enter(state, 'EBB');
  }

  switch (state.name) {
    case 'BUILD':
      // Exactly one phrase; the bloom lands on the next boundary, always.
      return enter(state, 'BLOOM');
    case 'BLOOM': {
      if (state.dwell >= DWELL_MAX.BLOOM || (state.dwell >= DWELL_MIN.BLOOM && draw < BLOOM_TO_EBB_P)) {
        return enter(state, 'EBB');
      }
      break;
    }
    case 'EBB': {
      if (state.dwell >= DWELL_MAX.EBB || (state.dwell >= DWELL_MIN.EBB && draw < 0.75)) {
        return enter(state, pick < clamp01(EBB_TO_REST_P + inputs.restBoost) ? 'REST' : 'BED');
      }
      break;
    }
    case 'BED': {
      if (state.dwell >= DWELL_MIN.BED) {
        const pBuild = buildAllowed
          ? clamp01(BED_TO_BUILD_P_BASE + BED_TO_BUILD_ENERGY_BOOST * inputs.energy) *
            clamp01(1 - inputs.restBoost)
          : 0;
        const pRest = clamp01(
          BED_TO_REST_P_PER_PHRASE * (state.dwell - DWELL_MIN.BED + 1) + inputs.restBoost
        );
        if (draw < pBuild) return enter(state, 'BUILD');
        if (state.dwell >= DWELL_MAX.BED || pick < pRest) return enter(state, 'REST');
      }
      break;
    }
    case 'REST': {
      if (state.dwell >= DWELL_MIN.REST) {
        const pLift = clamp01(
          REST_TO_BED_P_BASE +
            REST_LIFT_WONDER_BOOST * inputs.wonder +
            REST_LIFT_ENERGY_BOOST * inputs.energy -
            inputs.restBoost
        );
        if (state.dwell >= DWELL_MAX.REST || draw < pLift) return enter(state, 'BED');
      }
      break;
    }
  }

  state.dwell += 1;
  return state;
}

/** Per-family layer levels for the state (owner-retunable in tuning.ts). */
export function arrangementLevels(name: ArrangementStateName): BedLayerLevels {
  return ARRANGEMENT_LEVELS[name];
}
