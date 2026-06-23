import React, { useEffect, useState } from 'react';
import { getLookedAt } from '../../game/systems/targeting.ts';
import { BLOCKS } from '../../game/data/blocks.ts';
import { RESOURCES } from '../../game/data/resources.ts';

/**
 * Tiny readout of whatever is under the crosshair — a voxel block (with any ore
 * deposit), a Tree, or a Loose Stone (the player publishes it; we poll a few
 * times/sec). Sits just under the crosshair.
 */
const LookedAtIndicator: React.FC = () => {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      const target = getLookedAt();
      let label: string | null = null;
      if (target?.kind === 'voxel') {
        label = target.deposit
          ? `${BLOCKS[target.blockId].name}: ${RESOURCES[target.deposit.resourceId].name}`
          : BLOCKS[target.blockId].name;
      } else if (target?.kind === 'tree') {
        label = 'Tree';
      } else if (target?.kind === 'stone') {
        label = 'Loose Stone';
      }
      setName(label);
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
