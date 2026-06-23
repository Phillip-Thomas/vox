import React, { useEffect, useState } from 'react';
import { subscribeInventory, getInventory } from '../../game/systems/inventorySystem.ts';
import { RESOURCES, type ResourceId } from '../../game/data/resources.ts';

/**
 * Harvested-resource inventory (live, subscribes to inventorySystem). Hidden until
 * something is gathered. Top-left + collapsible so it never sits under the mobile
 * movement joystick (bottom-left). The container is pointer-transparent except the
 * collapse toggle, so it doesn't eat touches meant for the world.
 */
const InventoryPanel: React.FC = () => {
  const [inv, setInv] = useState<Partial<Record<ResourceId, number>>>(getInventory());
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => subscribeInventory(() => setInv(getInventory())), []);
  const entries = (Object.entries(inv) as [ResourceId, number][]).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div style={{
      position: 'absolute', left: 14, top: 14, minWidth: 138,
      background: 'rgba(10,14,20,0.6)', border: '1px solid rgba(150,180,210,0.25)',
      borderRadius: 8, color: '#e6edf3', fontFamily: 'monospace', fontSize: 12,
      zIndex: 25, backdropFilter: 'blur(3px)', overflow: 'hidden',
      pointerEvents: 'none'
    }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        aria-label={collapsed ? 'Show inventory' : 'Hide inventory'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          width: '100%', padding: '7px 10px', cursor: 'pointer',
          background: 'transparent', border: 'none', color: 'inherit',
          fontFamily: 'inherit', fontSize: 10, letterSpacing: 1, opacity: 0.72,
          pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent',
          userSelect: 'none', WebkitUserSelect: 'none'
        }}
      >
        <span>INVENTORY{collapsed ? ` · ${total}` : ''}</span>
        <span style={{ opacity: 0.8 }}>{collapsed ? '▸' : '▾'}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '0 10px 8px' }}>
          {entries.map(([id, n]) => (
            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '1px 0' }}>
              <span>{RESOURCES[id].name}</span>
              <span style={{ opacity: 0.85 }}>{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InventoryPanel;
