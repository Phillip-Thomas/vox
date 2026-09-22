// A measured loudness is an observation, not an input to a matched render.
// Hash the actual script and sampled driving controls; bind both times used
// by the fresh BLOOM search without rounding or tolerances.
export function diagnosticScriptIdentity(meta) {
  const d = meta.diagnostics;
  for (const hash of [d?.originalSfxScriptSha256, d?.drivingSignalsSha256]) {
    if (!/^[a-f0-9]{64}$/.test(hash ?? '')) throw new Error('Missing diagnostic input hash');
  }
  const bloom = meta.stressEvidence?.bloomReference;
  if (bloom && (!Number.isFinite(bloom.windowStartS) || !Number.isFinite(bloom.impactAtS))) {
    throw new Error('Missing diagnostic BLOOM input time');
  }
  return JSON.stringify([
    d.originalSfxScriptSha256,
    d.drivingSignalsSha256,
    bloom ? [bloom.windowStartS, bloom.impactAtS] : null,
  ]);
}
