import React, { useEffect, useState } from 'react';
import { getLookedAtVoxel } from '../../game/systems/targeting.ts';
import { BLOCKS } from '../../game/data/blocks.ts';
import { RESOURCES } from '../../game/data/resources.ts';

/**
 * Tiny readout of the material currently under the crosshair (the player's voxel
 * ray-march publishes it; we poll a few times/sec). Sits just under the crosshair.
 */
const LookedAtIndicator: React.FC = () => {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const target = getLookedAtVoxel();
      setName(target
        ? target.deposit
          ? `${BLOCKS[target.blockId].name}: ${RESOURCES[target.deposit.resourceId].name}`
          : BLOCKS[target.blockId].name
        : null);
    }, 120);
    return () => clearInterval(id);
  }, []);
  if (!name) return null;
  return (
    <div style={{
      position: 'absolute', top: 'calc(50% + 18px)', left: '50%', transform: 'translateX(-50%)',
      color: '#dfe7ee', fontFamily: 'monospace', fontSize: 12, letterSpacing: 0.5,
      textShadow: '0 1px 3px rgba(0,0,0,0.9)', pointerEvents: 'none', zIndex: 25, opacity: 0.85
    }}>
      {name}
    </div>
  );
};

export default LookedAtIndicator;
