import { useFrame } from '@react-three/fiber';
import { markFramePainted } from '../state/appState';

/**
 * Counts painted frames into the app shell's scene-ready signal. Lives inside the
 * <Canvas> (it needs the r3f render loop) and is cheap — `markFramePainted` is a
 * no-op once the scene is ready. Paired with `markTerrainPopulated` (emitted from
 * EfficientPlanet) to decide when the loading screen / Play button reveal.
 */
export default function SceneReadyProbe() {
  useFrame(() => markFramePainted());
  return null;
}
