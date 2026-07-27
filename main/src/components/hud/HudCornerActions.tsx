import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { isTouchDevice, releaseAllKeys } from '../../utils/mobileInput.ts';
import { theme } from '../../ui/theme.ts';
import { hudIconButtonStyle, hudTopRightClusterStyle } from './hudChrome.ts';
import {
  closeMobileHudDisclosure,
  getActiveMobileHudDisclosure,
  subscribeMobileHudDisclosure,
  toggleMobileHudDisclosure
} from '../mobile/mobileHudDisclosure.ts';

interface HudCornerActionsProps {
  controlMode: 'fps' | 'flight';
  buildModeOpen: boolean;
  /** Story chapters hide the gated affordances (sandbox: always true). */
  allowBuild?: boolean;
  allowCraft?: boolean;
  /**
   * Whether the survey chart is openable right now. Mirrors the desktop [M]
   * gate so touch gets the same chart affordance the keyboard has. Only wired
   * on touch (desktop opens the chart with the M key).
   */
  allowChart?: boolean;
  onToggleBuild: () => void;
  onOpenCrafting: () => void;
  onOpenChart?: () => void;
  onPause: () => void;
  pauseLabel?: string;
}

const HudCornerActions: React.FC<HudCornerActionsProps> = ({
  controlMode,
  buildModeOpen,
  allowBuild = true,
  allowCraft = true,
  allowChart = false,
  onToggleBuild,
  onOpenCrafting,
  onOpenChart,
  onPause,
  pauseLabel = 'Pause and open star map'
}) => {
  const showFootActions = controlMode === 'fps';
  const touch = isTouchDevice();
  const activeDisclosure = useSyncExternalStore(
    subscribeMobileHudDisclosure,
    getActiveMobileHudDisclosure,
    () => null
  );
  const mobileOpen = touch && activeDisclosure === 'systems';
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    releaseAllKeys();
    const frame = requestAnimationFrame(() => firstActionRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeMobileHudDisclosure('systems');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      requestAnimationFrame(() => {
        if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
      });
    };
  }, [mobileOpen]);

  useEffect(() => {
    closeMobileHudDisclosure('systems');
  }, [controlMode]);

  const runMobileAction = (action: () => void) => {
    closeMobileHudDisclosure('systems');
    action();
  };

  if (touch) {
    // The touch equivalent of the desktop corner cluster + [M] key. CHART sits
    // beside PAUSE only when the chart is actually openable (mirrors the desktop
    // gate), so a touch player is never offered a control that does nothing.
    const menuItems: { key: string; label: string; action: () => void }[] = [];
    if (showFootActions && allowBuild) {
      menuItems.push({ key: 'build', label: buildModeOpen ? 'CLOSE BUILD' : 'BUILD', action: onToggleBuild });
    }
    if (showFootActions && allowCraft) {
      menuItems.push({ key: 'craft', label: 'FABRICATOR', action: onOpenCrafting });
    }
    if (allowChart && onOpenChart) {
      menuItems.push({ key: 'chart', label: 'CHART', action: onOpenChart });
    }
    menuItems.push({ key: 'pause', label: 'PAUSE', action: onPause });

    const menuButtonStyle: React.CSSProperties = {
      width: '100%',
      minHeight: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '0 13px',
      border: 0,
      borderTop: '1px solid rgba(125,211,252,0.1)',
      background: 'transparent',
      color: theme.color.text,
      fontFamily: theme.font.mono,
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '0.08em',
      cursor: 'pointer',
      touchAction: 'manipulation',
      WebkitTapHighlightColor: 'transparent'
    };

    return (
      <div aria-label="HUD quick actions" style={hudTopRightClusterStyle()}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={mobileOpen ? 'Close systems menu' : 'Open systems menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-hud-systems-menu"
          onClick={() => toggleMobileHudDisclosure('systems')}
          style={hudIconButtonStyle(buildModeOpen || mobileOpen)}
        >
          <span aria-hidden="true" style={{ display: 'grid', gap: 3 }}>
            <span style={{ width: 15, height: 1, background: 'currentColor' }} />
            <span style={{ width: 10, height: 1, marginLeft: 5, background: 'currentColor' }} />
            <span style={{ width: 15, height: 1, background: 'currentColor' }} />
          </span>
        </button>

        {mobileOpen && (
          <>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => closeMobileHudDisclosure('systems')}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: theme.z.hud + 6,
                border: 0,
                background: 'transparent',
                cursor: 'default'
              }}
            />
            <div
              id="mobile-hud-systems-menu"
              data-testid="mobile-hud-systems-menu"
              role="group"
              aria-label="Systems"
              style={{
                position: 'fixed',
                top: 'calc(66px + env(safe-area-inset-top, 0px))',
                right: 'calc(14px + env(safe-area-inset-right, 0px))',
                width: 176,
                overflow: 'hidden',
                border: theme.glass.border,
                borderRadius: theme.radius.md,
                background: 'linear-gradient(160deg, rgba(10,18,31,0.98), rgba(5,9,17,0.97))',
                boxShadow: '0 18px 44px rgba(0,0,0,0.48)',
                backdropFilter: theme.glass.blur,
                WebkitBackdropFilter: theme.glass.blur,
                zIndex: theme.z.hud + 8
              }}
            >
              <div style={{ padding: '10px 13px 8px', color: theme.color.textFaint, fontSize: 9, letterSpacing: '0.18em' }}>
                FIELD SYSTEMS
              </div>
              {menuItems.map((item, index) => (
                <button
                  key={item.key}
                  ref={index === 0 ? firstActionRef : undefined}
                  type="button"
                  onClick={() => runMobileAction(item.action)}
                  style={menuButtonStyle}
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div aria-label="HUD quick actions" style={hudTopRightClusterStyle()}>
      {showFootActions && allowBuild && (
        <button
          type="button"
          onClick={onToggleBuild}
          aria-label={buildModeOpen ? 'Close build editor' : 'Open build editor'}
          title={buildModeOpen ? 'Close build editor' : 'Open build editor'}
          style={hudIconButtonStyle(buildModeOpen)}
        >
          B
        </button>
      )}
      {showFootActions && allowCraft && (
        <button
          type="button"
          onClick={onOpenCrafting}
          aria-label="Open fabricator"
          title="Open fabricator"
          style={hudIconButtonStyle()}
        >
          C
        </button>
      )}
      <button
        type="button"
        onClick={onPause}
        aria-label={pauseLabel}
        title={pauseLabel}
        style={hudIconButtonStyle()}
      >
        M
      </button>
    </div>
  );
};

export default HudCornerActions;
