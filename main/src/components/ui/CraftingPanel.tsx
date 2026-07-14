import React, { useEffect, useRef, useState } from 'react';
import { theme, glassPanel } from '../../ui/theme.ts';
import { getItem } from '../../game/data/items.ts';
import { getAccessibleStations, getStation, type StationId } from '../../game/data/stations.ts';
import type { Recipe } from '../../game/data/recipes.ts';
import { canCraft, type CraftContext } from '../../game/systems/craftingSystem.ts';
import { getItemCount, subscribeInventory } from '../../game/systems/inventorySystem.ts';
import { getPlayerUp, getPlayerWorldPosition } from '../../state/playerFrame.ts';
import type { CommandContext } from '../../game/commands.ts';
import { craftAndPlaceCampfireCommand, craftRecipeCommand } from '../../game/gameplayCommands.ts';
import { dispatchGameplayCommand } from '../../game/commandDispatchAdapter.ts';
import { getStoryInputPolicy } from '../../story/storyInputPolicy.ts';
import { getStoryStateSnapshot } from '../../story/storyState.ts';
import { getPublicFabricatorSections } from './Fabricator.model.ts';
import { getPlayerSubmergence } from '../../state/playerSubmersion.ts';
import { isFeetInLava } from '../../state/playerLavaImmersion.ts';

interface CraftingPanelProps {
  open: boolean;
  onClose: () => void;
  commandContext: CommandContext;
}

interface CraftStorySnapshot {
  active: boolean;
  beat: string | null;
  runId: number;
}

/** A successful recipe that advances story ownership must dismiss the modal. */
export function craftTriggeredStoryTransition(
  crafted: boolean,
  before: CraftStorySnapshot,
  after: CraftStorySnapshot
): boolean {
  return crafted
    && (before.active || after.active)
    && (
      before.active !== after.active
      || before.beat !== after.beat
      || before.runId !== after.runId
    );
}

/**
 * The Fabricator: the player's crafting screen. Lists every recipe at the
 * stations currently reachable (a portable fabricator grants all for now),
 * grouped by station. Inputs show have/need and a recipe only crafts when its
 * materials are met. Subscribes to the inventory so counts + craftability update
 * live as you craft. Pointer-lock / pause coordination is handled by App.
 */
const CraftingPanel: React.FC<CraftingPanelProps> = ({ open, onClose, commandContext }) => {
  const [, force] = useState(0);
  const [status, setStatus] = useState('Primitive field kit ready.');
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => subscribeInventory(() => force(n => n + 1)), []);

  useEffect(() => {
    if (!open) return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[data-fabricator-primary]')?.focus();
    });
    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    const siblings = overlay && parent
      ? [...parent.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child !== overlay)
      : [];
    const previous = siblings.map(element => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden')
    }));
    for (const element of siblings) {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    }
    return () => {
      cancelAnimationFrame(frame);
      for (const { element, inert, ariaHidden } of previous) {
        element.inert = inert;
        if (ariaHidden == null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      }
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    };
  }, [open]);

  if (!open) return null;

  const ctx: CraftContext = { stations: getAccessibleStations() };
  const sections = getPublicFabricatorSections(getStoryInputPolicy().recipeAllowed);

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fabricator-title"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }
        if (event.key !== 'Tab') return;
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onBlurCapture={event => {
        const next = event.relatedTarget;
        if (next instanceof Node && panelRef.current?.contains(next)) return;
        requestAnimationFrame(() => {
          panelRef.current?.querySelector<HTMLElement>('[data-fabricator-primary]')?.focus();
        });
      }}
      style={{
      position: 'fixed', inset: 0, zIndex: theme.z.menu,
      fontFamily: theme.font.ui, color: theme.color.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'radial-gradient(120% 100% at 50% 50%, rgba(5,8,15,0.5) 0%, rgba(5,8,15,0.8) 100%)',
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      animation: 'pvFloatIn 200ms ease both'
    }}>
      <div ref={panelRef} style={{
        ...glassPanel, background: theme.glass.backgroundStrong,
        width: 'min(640px, 95vw)', maxHeight: '88vh', overflowY: 'auto',
        padding: 'clamp(20px, 4vw, 34px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
          <div id="fabricator-title" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.12em' }}>FABRICATOR</div>
          <button data-fabricator-primary onClick={onClose} aria-label="Close fabricator" style={{
            fontFamily: theme.font.mono, fontSize: 12, letterSpacing: '0.1em',
            color: theme.color.textDim, background: 'transparent',
            border: '1px solid rgba(125,211,252,0.25)', borderRadius: theme.radius.sm,
            padding: '6px 12px', cursor: 'pointer'
          }}>ESC ✕</button>
        </div>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', color: theme.color.textFaint, textTransform: 'uppercase', marginBottom: 6 }}>
          {getStoryStateSnapshot().active
            ? 'Primitive field assembly · none of this is regulation'
            : 'Portable field kit · primitive patterns only'}
        </div>

        <div aria-live="polite" style={{
          marginTop: 10, minHeight: 18, color: theme.color.accent,
          fontFamily: theme.font.mono, fontSize: 11, lineHeight: 1.5
        }}>{status}</div>

        {sections.map(section => (
          <StationSection
            key={section.stationId}
            stationId={section.stationId}
            recipes={section.recipes}
            ctx={ctx}
            commandContext={commandContext}
            onStatus={setStatus}
            onStoryTriggered={onClose}
          />
        ))}
      </div>
    </div>
  );
};

const StationSection: React.FC<{
  stationId: StationId;
  recipes: Recipe[];
  ctx: CraftContext;
  commandContext: CommandContext;
  onStatus: (message: string) => void;
  onStoryTriggered: () => void;
}> = ({ stationId, recipes, ctx, commandContext, onStatus, onStoryTriggered }) => {
  if (recipes.length === 0) return null;
  const station = getStation(stationId);
  return (
    <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(125,211,252,0.12)' }}>
      <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.color.accent, marginBottom: 2 }}>
        {station.name}
      </div>
      <div style={{ fontSize: 11, color: theme.color.textFaint, marginBottom: 12 }}>{station.description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {recipes.map(r => (
          <RecipeRow
            key={r.id}
            recipe={r}
            ctx={ctx}
            commandContext={commandContext}
            onStatus={onStatus}
            onStoryTriggered={onStoryTriggered}
          />
        ))}
      </div>
    </div>
  );
};

const RecipeRow: React.FC<{
  recipe: Recipe;
  ctx: CraftContext;
  commandContext: CommandContext;
  onStatus: (message: string) => void;
  onStoryTriggered: () => void;
}> = ({ recipe, ctx, commandContext, onStatus, onStoryTriggered }) => {
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
          const storyBeforeCraft = getStoryStateSnapshot();
          let crafted = false;
          if (recipe.id === 'campfire') {
            if (getPlayerSubmergence() > 0.2 || isFeetInLava()) {
              onStatus('Campfire cannot be placed while submerged or standing in lava. Move out and try again.');
              return;
            }
            // A campfire is placed where you stand, not stockpiled — drop it to the
            // player's feet and consume the just-crafted item.
            const feet = getPlayerWorldPosition().addScaledVector(getPlayerUp(), -1.1);
            const up = getPlayerUp();
            const result = dispatchGameplayCommand(
              () => craftAndPlaceCampfireCommand(commandContext, { recipe, craftContext: ctx, position: feet, up }),
              {
                multiplayer: {
                  commandType: 'craft_campfire',
                  payload: {
                    recipeId: recipe.id,
                    pos: [feet.x, feet.y, feet.z],
                    up: [up.x, up.y, up.z]
                  }
                }
              }
            );
            crafted = result.ok;
          } else {
            const result = dispatchGameplayCommand(
              () => craftRecipeCommand(commandContext, { recipe, craftContext: ctx }),
              {
                multiplayer: {
                  commandType: 'recipe_crafted',
                  payload: { recipeId: recipe.id }
                }
              }
            );
            crafted = result.ok;
          }
          onStatus(crafted
            ? recipe.id === 'campfire' ? 'Campfire placed at your feet.' : `${out.name} crafted.`
            : `Unable to craft ${out.name}. Check materials and placement.`);
          // Campfire placement emits synchronously; by the time the command
          // returns, the director has entered its fire-to-dusk sequence. Close
          // before the first cinematic frame so the modal never masks the shot.
          if (craftTriggeredStoryTransition(crafted, storyBeforeCraft, getStoryStateSnapshot())) {
            onStoryTriggered();
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
      >{check.blockedBy === 'owned' ? 'Owned' : 'Craft'}</button>
    </div>
  );
};

export default CraftingPanel;
