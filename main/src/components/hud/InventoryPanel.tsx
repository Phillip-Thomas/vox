import React, { useEffect, useState } from 'react';
import { subscribeInventory, getInventory } from '../../game/systems/inventorySystem.ts';
import { RESOURCES, type ResourceId } from '../../game/data/resources.ts';

/**
 * Harvested-resource inventory (live, subscribes to inventorySystem). Hidden until
 * something is gathered. Bottom-left, themed to the HUD.
 */
const InventoryPanel: React.FC = () => {
  const [inv, setInv] = useState<Partial<Record<ResourceId, number>>>(getInventory());
  useEffect(() => subscribeInventory(() => setInv(getInventory())), []);
  const entries = (Object.entries(inv) as [ResourceId, number][]).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div style={{
      position: 'absolute', left: 14, bottom: 14, minWidth: 150,
      background: 'rgba(10,14,20,0.6)', border: '1px solid rgba(150,180,210,0.25)',
      borderRadius: 8, padding: '8px 10px', color: '#e6edf3', fontFamily: 'monospace',
      fontSize: 12, pointerEvents: 'none', zIndex: 25, backdropFilter: 'blur(3px)'
    }}>
      <div style={{ opacity: 0.55, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>INVENTORY</div>
      {entries.map(([id, n]) => (
        <div key={id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
          <span>{RESOURCES[id].name}</span>
          <span style={{ opacity: 0.85 }}>{n}</span>
        </div>
      ))}
    </div>
  );
};

export default InventoryPanel;
