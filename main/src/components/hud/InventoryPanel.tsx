import React, { useEffect, useMemo, useState } from 'react';
import { subscribeInventory, getInventory } from '../../game/systems/inventorySystem.ts';
import { getItem, type ItemId, type ItemKind } from '../../game/data/items.ts';
import { theme } from '../../ui/theme.ts';
import { HUD_EDGE, hudGlassPanelStyle } from './hudChrome.ts';

/**
 * Held-item inventory (live, subscribes to inventorySystem). It starts as a
 * compact top-left button and expands on demand, so it never sits under the
 * mobile movement joystick (bottom-left). The container is pointer-transparent
 * except the collapse toggle, so it doesn't eat touches meant for the world.
 *
 * Items are grouped by kind so crafted gear (tools/suits/modules) reads apart from
 * raw resources as the inventory grows.
 */

// Display order + labels for the kind groups (raw materials first, gear last).
const KIND_ORDER: { kind: ItemKind; label: string }[] = [
  { kind: 'resource', label: 'Resources' },
  { kind: 'refined', label: 'Refined' },
  { kind: 'component', label: 'Components' },
  { kind: 'tool', label: 'Tools' },
  { kind: 'suit', label: 'Suits' },
  { kind: 'module', label: 'Modules' },
  { kind: 'consumable', label: 'Consumables' },
  { kind: 'light', label: 'Lights' },
  { kind: 'placeable', label: 'Structures' }
];

interface InventoryPanelProps {
  topOffset?: number;
}

const InventoryPanel: React.FC<InventoryPanelProps> = ({ topOffset = HUD_EDGE }) => {
  const [inv, setInv] = useState<Partial<Record<ItemId, number>>>(getInventory());
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => subscribeInventory(() => setInv(getInventory())), []);

  const entries = useMemo(
    () => (Object.entries(inv) as [ItemId, number][]).filter(([, n]) => n > 0),
    [inv]
  );

  const groups = useMemo(() => {
    return KIND_ORDER
      .map(({ kind, label }) => ({
        label,
        items: entries.filter(([id]) => getItem(id).kind === kind)
      }))
      .filter(g => g.items.length > 0);
  }, [entries]);

  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const multiGroup = groups.length > 1;

  return (
    <div data-testid="inventory-panel" style={hudGlassPanelStyle({
      position: 'absolute',
      left: HUD_EDGE,
      top: topOffset,
      minWidth: collapsed ? 84 : 164,
      maxWidth: 230,
      borderRadius: theme.radius.md,
      fontSize: 12,
      zIndex: theme.z.hud + 4,
      overflow: 'hidden',
      background: collapsed
        ? 'linear-gradient(180deg, rgba(14,22,38,0.72), rgba(5,9,17,0.58))'
        : 'linear-gradient(180deg, rgba(10,18,32,0.68), rgba(5,9,17,0.54))'
    })}>
      <button
        data-testid="inventory-button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show inventory' : 'Hide inventory'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          width: '100%', padding: collapsed ? '9px 11px' : '7px 10px', cursor: 'pointer',
          background: 'transparent', border: 'none', color: theme.color.accent,
          fontFamily: 'inherit', fontSize: 10, letterSpacing: 0, opacity: 0.96,
          pointerEvents: 'auto', WebkitTapHighlightColor: 'transparent',
          userSelect: 'none', WebkitUserSelect: 'none'
        }}
      >
        <span>INV{total > 0 ? ` · ${total}` : ''}</span>
        <span style={{ opacity: 0.8 }}>{collapsed ? '+' : '−'}</span>
      </button>
      {!collapsed && (
        <div data-testid="inventory-contents" style={{ padding: '0 10px 8px' }}>
          {groups.length === 0 ? (
            <div style={{ padding: '2px 0 4px', color: theme.color.textFaint, fontSize: 10 }}>EMPTY</div>
          ) : (
            groups.map(({ label, items }) => (
              <div key={label}>
                {multiGroup && (
                  <div style={{
                    marginTop: 6, fontSize: 9, letterSpacing: 0, opacity: 0.48,
                    textTransform: 'uppercase'
                  }}>{label}</div>
                )}
                {items.map(([id, n]) => (
                  <div key={id} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '1px 0' }}>
                    <span>{getItem(id).name}</span>
                    <span style={{ opacity: 0.85 }}>{n}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default InventoryPanel;
