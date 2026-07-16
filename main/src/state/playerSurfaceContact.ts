/**
 * Raw local contact published by the on-foot physics controller. This is kept
 * separate from smoothed eye submergence: route audits need to know whether the
 * capsule's feet actually touched water and whether a real support probe held
 * the body on that sample.
 *
 * Consumers receive a fresh readonly snapshot, so they cannot mutate the
 * controller-owned state.
 */
export interface LocalPlayerSurfaceContact {
  readonly feetInWater: boolean;
  readonly physicallySupported: boolean;
}

let feetInWater = false;
let physicallySupported = false;

/** Physics-writer seam. Gameplay and probes should prefer the getter below. */
export function setLocalPlayerSurfaceContact(
  nextFeetInWater: boolean,
  nextPhysicallySupported: boolean
): void {
  feetInWater = nextFeetInWater === true;
  physicallySupported = nextPhysicallySupported === true;
}

export function getLocalPlayerSurfaceContact(): LocalPlayerSurfaceContact {
  return { feetInWater, physicallySupported };
}

export function resetLocalPlayerSurfaceContact(): void {
  feetInWater = false;
  physicallySupported = false;
}
