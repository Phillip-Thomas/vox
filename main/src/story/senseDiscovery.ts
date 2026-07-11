import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { getVitals } from '../game/systems/survivalVitals.ts';
import { getMawChargeFraction } from '../game/systems/mawSystem.ts';
import { getStoryStateSnapshot, STORY_MILESTONES } from './storyState.ts';
import { showCaption } from './storyText.ts';

// --- The self-discovery arc -------------------------------------------------------
//
// The embodied narrator gains senses ONE AT A TIME: each suit-HUD stat appears
// the first time its sensation is actually FELT, some with a spoken discovery
// (lowercase, both-readings — see the hidden pillar). Health and warmth are
// introduced by the ch3 script; everything here discovers live, post-dawn.
// Milestone-gated: pure sandbox saves (story never started) are untouched, and
// each check disappears forever once its milestone lands.

const m = STORY_MILESTONES;

let lastMawCharge = -1;

/**
 * Ticked from the player loop (cheap: milestone lookups short-circuit).
 * `jetFuel` is 0..1 (passed in — the jetpack state lives in EfficientPlayer).
 */
export function tickSenseDiscovery(jetFuel: number): void {
  if (!hasMilestone(m.started)) return;

  // The first-day scenes OWN their sensations while their beats run (the
  // director names them on cue — see storyDirector's tickThirst/Forage/Signal);
  // these live checks remain as fallbacks for the settled post-story world.
  const beat = getStoryStateSnapshot().beat;
  const sceneOwnsNeeds = beat === 'ch3-thirst' || beat === 'ch3-forage';
  const sceneOwnsStamina = beat === 'ch3-signal';

  // Post-awakening bodily needs (the dawn hands the body over for real).
  if (hasMilestone(m.a3) && !sceneOwnsNeeds) {
    const v = getVitals();
    if (!hasMilestone(m.senseWater) && v.thirst < 65) {
      markMilestone(m.senseWater);
      showCaption('so that is thirst. how strange, to need.');
    }
    if (!hasMilestone(m.senseFood) && v.hunger < 65) {
      markMilestone(m.senseFood);
      showCaption('hunger. the body burns something to keep being a body.');
    }
  }

  // Quiet discoveries: the readout simply appears with first use.
  if (hasMilestone(m.a2)) {
    const v = getVitals();
    if (!hasMilestone(m.senseStamina) && !sceneOwnsStamina && v.stamina < 85) markMilestone(m.senseStamina);
    if (!hasMilestone(m.senseOxygen) && v.oxygen < 92) markMilestone(m.senseOxygen);
    if (!hasMilestone(m.senseJet) && jetFuel < 0.99) markMilestone(m.senseJet);
    if (!hasMilestone(m.senseMaw)) {
      const charge = getMawChargeFraction();
      // The Maw's readout manifests when the cell first RISES (the refuel) —
      // arriving drained doesn't count as knowing what it is.
      if (lastMawCharge >= 0 && charge > lastMawCharge + 0.001) markMilestone(m.senseMaw);
      lastMawCharge = charge;
    }
  }
}
