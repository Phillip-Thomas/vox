export interface MawResonanceRingFrame {
  phase: number;
  scale: number;
  opacity: number;
}

export function fieldPackCorePulseAt(elapsedSeconds: number): number {
  return 0.5 + Math.sin(Math.max(0, elapsedSeconds) * 2.1) * 0.5;
}

export function fieldPackSegmentHeightAt(
  elapsedSeconds: number,
  index: number,
  localProgress: number
): number {
  const remainingMotion = 1 - Math.max(0, Math.min(1, localProgress));
  return 0.88
    + Math.sin((Math.max(0, elapsedSeconds) + index) * 2.4) * 0.025 * remainingMotion;
}

export function mawResonanceRingFrameAt(
  elapsedSeconds: number,
  index: number
): MawResonanceRingFrame {
  const phase = (Math.max(0, elapsedSeconds) * 0.32 + index / 3) % 1;
  return {
    phase,
    scale: 0.45 + phase * 2.25,
    opacity: Math.max(0.05, (1 - phase) * 0.62)
  };
}
