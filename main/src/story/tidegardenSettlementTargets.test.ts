import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  publishTidegardenSettlementTargets,
  resetTidegardenSettlementTargetsForTests,
  resolveTidegardenSettlementTarget
} from './tidegardenSettlementTargets.ts';

const SHIP = new THREE.Vector3(1, 2, 3);
const RELATIONSHIP = new THREE.Vector3(4, 5, 6);
const RECOMMENDED = new THREE.Vector3(7, 8, 9);
const CHOSEN = new THREE.Vector3(10, 11, 12);
const CORE = new THREE.Vector3(13, 14, 15);

beforeEach(() => resetTidegardenSettlementTargetsForTests());

describe('Tidegarden settlement target authority', () => {
  it.each([
    ['scan-waterline', RELATIONSHIP],
    ['attend-waterline', RELATIONSHIP],
    ['choose-site', RECOMMENDED],
    ['craft-core', SHIP],
    ['foundation', CHOSEN],
    ['install-core', CHOSEN],
    ['certify-shelter', CORE],
    ['wait-night', CORE],
    ['rest', CORE]
  ] as const)('maps %s to its actual interaction anchor', (guidanceId, expected) => {
    publishTidegardenSettlementTargets({
      shipPosition: SHIP,
      relationshipPosition: RELATIONSHIP,
      recommendedSitePosition: RECOMMENDED,
      chosenSitePosition: CHOSEN,
      corePosition: CORE
    });
    expect(resolveTidegardenSettlementTarget(guidanceId)?.toArray()).toEqual(expected.toArray());
  });

  it('clears only the active publisher and never leaks mutable vectors', () => {
    const clearFirst = publishTidegardenSettlementTargets({
      shipPosition: SHIP,
      relationshipPosition: RELATIONSHIP,
      recommendedSitePosition: RECOMMENDED,
      chosenSitePosition: CHOSEN,
      corePosition: CORE
    });
    const clearSecond = publishTidegardenSettlementTargets({
      shipPosition: SHIP.clone().multiplyScalar(2),
      relationshipPosition: RELATIONSHIP,
      recommendedSitePosition: RECOMMENDED,
      chosenSitePosition: CHOSEN,
      corePosition: CORE
    });
    clearFirst();
    const resolved = resolveTidegardenSettlementTarget('craft-core');
    expect(resolved?.toArray()).toEqual([2, 4, 6]);
    resolved?.set(99, 99, 99);
    expect(resolveTidegardenSettlementTarget('craft-core')?.toArray()).toEqual([2, 4, 6]);
    clearSecond();
    expect(resolveTidegardenSettlementTarget('craft-core')).toBeNull();
  });
});
