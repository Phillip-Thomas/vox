import * as THREE from 'three';

/**
 * Tidegarden publishes the same physical anchors used by its interactions so
 * the HUD never has to reconstruct destination-world geometry from Origin-only
 * story anchors or a moving player pose.
 */
export interface TidegardenSettlementTargets {
  shipPosition: THREE.Vector3 | null;
  relationshipPosition: THREE.Vector3 | null;
  recommendedSitePosition: THREE.Vector3 | null;
  chosenSitePosition: THREE.Vector3 | null;
  corePosition: THREE.Vector3 | null;
}

export const tidegardenSettlementTargets: TidegardenSettlementTargets = {
  shipPosition: null,
  relationshipPosition: null,
  recommendedSitePosition: null,
  chosenSitePosition: null,
  corePosition: null
};

let publisher: symbol | null = null;

export function publishTidegardenSettlementTargets(
  targets: TidegardenSettlementTargets
): () => void {
  const token = Symbol('tidegarden-settlement-targets');
  publisher = token;
  copyTargets(targets);
  return () => {
    if (publisher !== token) return;
    publisher = null;
    copyTargets({
      shipPosition: null,
      relationshipPosition: null,
      recommendedSitePosition: null,
      chosenSitePosition: null,
      corePosition: null
    });
  };
}

export function resolveTidegardenSettlementTarget(
  guidanceId: string
): THREE.Vector3 | null {
  const target = guidanceId === 'scan-waterline' || guidanceId === 'attend-waterline'
    ? tidegardenSettlementTargets.relationshipPosition
    : guidanceId === 'choose-site'
      ? tidegardenSettlementTargets.recommendedSitePosition
      : guidanceId === 'craft-core'
        ? tidegardenSettlementTargets.shipPosition
        : guidanceId === 'foundation' || guidanceId === 'install-core'
          ? tidegardenSettlementTargets.chosenSitePosition
          : guidanceId === 'certify-shelter'
            || guidanceId === 'wait-night'
            || guidanceId === 'rest'
            ? tidegardenSettlementTargets.corePosition
            : null;
  return target?.clone() ?? null;
}

export function resetTidegardenSettlementTargetsForTests(): void {
  publisher = null;
  copyTargets({
    shipPosition: null,
    relationshipPosition: null,
    recommendedSitePosition: null,
    chosenSitePosition: null,
    corePosition: null
  });
}

function copyTargets(targets: TidegardenSettlementTargets): void {
  tidegardenSettlementTargets.shipPosition = targets.shipPosition?.clone() ?? null;
  tidegardenSettlementTargets.relationshipPosition = targets.relationshipPosition?.clone() ?? null;
  tidegardenSettlementTargets.recommendedSitePosition = targets.recommendedSitePosition?.clone() ?? null;
  tidegardenSettlementTargets.chosenSitePosition = targets.chosenSitePosition?.clone() ?? null;
  tidegardenSettlementTargets.corePosition = targets.corePosition?.clone() ?? null;
}
