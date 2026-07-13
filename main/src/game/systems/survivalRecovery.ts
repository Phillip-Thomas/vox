let recoveryRequested = false;

/** The modal asks; the mounted player owns the actual physics-safe teleport. */
export function requestSurvivalRecovery(): void {
  recoveryRequested = true;
}

export function consumeSurvivalRecoveryRequest(): boolean {
  if (!recoveryRequested) return false;
  recoveryRequested = false;
  return true;
}

export function resetSurvivalRecoveryRequest(): void {
  recoveryRequested = false;
}
