import React, { useEffect, useState } from 'react';
import { theme, glassPanel } from '../../ui/theme.ts';
import { getItem } from '../../game/data/items.ts';
import { getAccessibleStations, getStation, type StationId } from '../../game/data/stations.ts';
import { recipesForStation, type Recipe } from '../../game/data/recipes.ts';
import { canCraft, craft, type CraftContext } from '../../game/systems/craftingSystem.ts';
import { getItemCount, removeItem, subscribeInventory } from '../../game/systems/inventorySystem.ts';
import { placeCampfire } from '../../game/systems/campfires.ts';
import { getPlayerUp, getPlayerWorldPosition } from '../../state/playerFrame.ts';

interface CraftingPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The Fabricator: the player's crafting screen. Lists every recipe at the
 * stations currently reachable (a portable fabricator grants all for now),
 * grouped by station. Inputs show have/need and a recipe only crafts when its
 * materials are met. Subscribes to the inventory so counts + craftability update
 * live as you craft. Pointer-lock / pause coordination is handled by App.
 */
const CraftingPanel: React.FC<CraftingPanelProps> = ({ open, onClose }) => {
  const [, force] = useState(0);
  useEffect(() => subscribeInventory(() => force(n => n + 1)), []);
  if (!open) return null;

  const ctx: CraftContext = { stations: getAccessibleStations() };
  const stations = getAccessibleStations();

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: theme.z.menu,
      fontFamily: theme.font.ui, color: theme.color.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'radial-gradient(120% 100% at 50% 50%, rgba(5,8,15,0.5) 0%, rgba(5,8,15,0.8) 100%)',
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      animation: 'pvFloatIn 200ms ease both'
    }}>
      <div style={{
        ...glassPanel, background: theme.glass.backgroundStrong,
        width: 'min(640px, 95vw)', maxHeight: '88vh', overflowY: 'auto',
        padding: 'clamp(20px, 4vw, 34px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.12em' }}>FABRICATOR</div>
          <button onClick={onClose} aria-label="Close fabricator" style={{
            fontFamily: theme.font.mono, fontSize: 12, letterSpacing: '0.1em',
            color: theme.color.textDim, background: 'transparent',
            border: '1px solid rgba(125,211,252,0.25)', borderRadius: theme.radius.sm,
            padding: '6px 12px', cursor: 'pointer'
          }}>ESC ✕</button>
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', color: theme.color.textFaint, textTransform: 'uppercase', marginBottom: 6 }}>
          Portable assembly · all stations online
        </div>

        {stations.map(stationId => (
          <StationSection key={stationId} stationId={stationId} ctx={ctx} />
        ))}
      </div>
    </div>
  );
};

const StationSection: React.FC<{ stationId: StationId; ctx: CraftContext }> = ({ stationId, ctx }) => {
  const recipes = recipesForStation(stationId);
  if (recipes.length === 0) return null;
  const station = getStation(stationId);
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(125,211,252,0.12)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 2 }}>
        {station.name}
      </div>
      <div style={{ fontSize: 11, color: theme.color.textFaint, marginBottom: 12 }}>{station.description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recipes.map(r => <RecipeRow key={r.id} recipe={r} ctx={ctx} />)}
      </div>
    </div>
  );
};

const RecipeRow: React.FC<{ recipe: Recipe; ctx: CraftContext }> = ({ recipe, ctx }) => {
  const out = getItem(recipe.id);
  const check = canCraft(recipe, ctx);
  const affordable = check.ok;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: 'rgba(8,13,24,0.45)', border: '1px solid rgba(125,211,252,0.12)',
      borderRadius: theme.radius.md, padding: '10px 12px'
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.color.text }}>
          {out.name}
          <span style={{ marginLeft: 8, fontSize: 10, color: theme.color.textFaint, fontFamily: theme.font.mono }}>
            T{out.tier}
          </span>
        </div>
        <div style={{ fontSize: 11, color: theme.color.textFaint, marginTop: 2, lineHeight: 1.4 }}>
          {out.description}
        </div>
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontFamily: theme.font.mono, fontSize: 11 }}>
          {recipe.inputs.map(inp => {
            const have = getItemCount(inp.id);
            const short = have < inp.qty;
            return (
              <span key={inp.id} style={{ color: short ? '#ff8585' : theme.color.textDim }}>
                {inp.qty}× {getItem(inp.id).name}
                <span style={{ opacity: 0.6 }}> ({have})</span>
              </span>
            );
          })}
        </div>
      </div>
      <button
        onClick={() => {
          if (!affordable) return;
          const res = craft(recipe, ctx);
          // A campfire is placed where you stand, not stockpiled — drop it to the
          // player's feet and consume the just-crafted item.
          if (res.ok && recipe.id === 'campfire') {
            const feet = getPlayerWorldPosition().addScaledVector(getPlayerUp(), -1.1);
            placeCampfire(feet, getPlayerUp());
            removeItem('campfire', 1);
          }
        }}
        disabled={!affordable}
        style={{
          flexShrink: 0,
          fontFamily: theme.font.ui, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
          color: affordable ? theme.color.void : theme.color.textFaint,
          background: affordable
            ? `linear-gradient(180deg, ${theme.color.accent}, ${theme.color.accentStrong})`
            : 'rgba(125,211,252,0.06)',
          border: affordable ? 'none' : '1px solid rgba(125,211,252,0.15)',
          borderRadius: theme.radius.md, padding: '9px 16px',
          cursor: affordable ? 'pointer' : 'default',
          boxShadow: affordable ? '0 4px 14px rgba(56,189,248,0.3)' : 'none',
          transition: `all ${theme.transition.base}`
        }}
      >Craft</button>
    </div>
  );
};

export default CraftingPanel;
