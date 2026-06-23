// --- Tech eras (the macro progression axis) ----------------------------------
//
// Eras are narrative acts as much as tech tiers. The player starts crash-landed in
// the PRIMITIVE era; repairing the Maw + building the first powered devices brings
// the EMERGENT era online (the space-tech tree); PARAVOX MACHINA (extradimensional)
// is the designed-for endgame. Recipes/devices are tagged with the era they belong
// to; the progression store advances `currentEra` when milestone items are crafted.

export type EraId = 'primitive' | 'emergent' | 'paravox_machina';

export interface EraDefinition {
  id: EraId;
  name: string;
  /** Strictly increasing — used to compare "at least this era". */
  order: number;
  description: string;
}

export const ERAS: Record<EraId, EraDefinition> = {
  primitive: {
    id: 'primitive', name: 'Primitive', order: 0,
    description: 'Crash-landed and stone-age. Forage by hand, knap tools, and salvage the wreck to revive your Maw.'
  },
  emergent: {
    id: 'emergent', name: 'Emergent', order: 1,
    description: 'The space tech comes back online. Build devices to refine, assemble, and survey.'
  },
  paravox_machina: {
    id: 'paravox_machina', name: 'Paravox Machina', order: 2,
    description: 'The extradimensional frontier — rift tooling and exotic matter.'
  }
};

export const ERA_ORDER: EraId[] = ['primitive', 'emergent', 'paravox_machina'];

export function getEra(id: EraId): EraDefinition {
  return ERAS[id];
}

/** Numeric rank of an era (for "at least" comparisons). */
export function eraRank(id: EraId): number {
  return ERAS[id].order;
}
