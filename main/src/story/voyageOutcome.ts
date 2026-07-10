import { hasMilestone, markMilestone } from '../game/systems/progressionSystem.ts';
import { feed } from '../game/systems/survivalVitals.ts';
import { MAX_MAW_CHARGE } from '../game/systems/mawSystem.ts';
import { setDebrisScattered } from './debrisSalvage.ts';

// --- Voyage outcome ------------------------------------------------------------------
//
// The final ledger becomes the crash: hull → how much debris the descent
// scatters, rations → arrival vitals, compliance → the tone of Ch1's paperwork,
// accumulated cell damage → the harvester's arrival charge. Everything persists
// as milestones / vitals / inventory through the EXISTING save — no new fields.

export interface VoyageLedgerFinal {
  rations: number;
  hull: number;
  compliance: number;
  /** Net harvester-cell delta accumulated from card effects. */
  cellDelta: number;
}

const CELL_MARK = 'story:cell:';
const TONE_LOW = 'story:tone:low';
const TONE_HIGH = 'story:tone:high';

export function applyVoyageOutcome(ledger: VoyageLedgerFinal): void {
  // Hull → debris scatter (worse landing, bigger field, more salvage to walk).
  const debris = ledger.hull >= 92 ? 3 : ledger.hull >= 78 ? 4 : ledger.hull >= 64 ? 5 : 6;
  setDebrisScattered(debris);

  // Rations → arrival hunger/thirst (96 was the provisioned baseline).
  const deficit = Math.max(0, 96 - ledger.rations);
  if (deficit > 0) feed(-deficit * 0.9, -deficit * 0.7);

  // Compliance → the register of Ch1's paperwork.
  if (ledger.compliance <= 78) markMilestone(TONE_LOW);
  else if (ledger.compliance >= 94) markMilestone(TONE_HIGH);

  // Cell damage → arrival charge (clamped so the raster act stays playable).
  const arrival = Math.max(40, Math.min(MAX_MAW_CHARGE, MAX_MAW_CHARGE + ledger.cellDelta));
  markMilestone(`${CELL_MARK}${Math.round(arrival / 10) * 10}`);
}

/** The harvester's arrival charge (ch1-raster entry reads this; default full). */
export function getArrivalCellCharge(): number {
  for (let n = 40; n <= MAX_MAW_CHARGE; n += 10) {
    if (hasMilestone(`${CELL_MARK}${n}`)) return n;
  }
  return MAX_MAW_CHARGE;
}

/** Extra work-order line earned by the voyage's compliance arc (or null). */
export function complianceToneLine(): string | null {
  if (hasMilestone(TONE_LOW)) return 'NOTE: YOUR COMPLIANCE INDEX ARRIVED DAMAGED. IT HAS BEEN NOTED.';
  if (hasMilestone(TONE_HIGH)) return 'NOTE: COMMENDATION PENDING REVIEW. DO NOT ANTICIPATE IT.';
  return null;
}
