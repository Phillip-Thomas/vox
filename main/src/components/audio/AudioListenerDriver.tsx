import { useEffect } from 'react';
import { addAfterEffect, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { setSfxListener } from '../../audio/sfxEngine.ts';
import { NEUTRAL_SFX_LISTENER } from '../../audio/sfx/spatialSfx.ts';
import { getMusicPrimitives } from '../../audio/musicPrimitives.ts';
import { getVoxelRealityStage } from '../../game/systems/realityRenderSystem.ts';

/** Read the final rendered camera, including authored rigs and vehicle ownership. */
export default function AudioListenerDriver(): null {
  const camera = useThree(state => state.camera);
  useEffect(() => {
    const position = new Vector3();
    const right = new Vector3();
    const unsubscribe = addAfterEffect(() => {
      camera.getWorldPosition(position);
      right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      setSfxListener({ position, right, era: getMusicPrimitives().era, stage: getVoxelRealityStage() });
    });
    return () => { unsubscribe(); setSfxListener(NEUTRAL_SFX_LISTENER); };
  }, [camera]);
  return null;
}
