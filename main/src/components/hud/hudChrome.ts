import type { CSSProperties } from 'react';
import { glassPanel, theme } from '../../ui/theme.ts';

export const HUD_EDGE = 14;
export const HUD_TOUCH_EDGE = 20;

export const hudNoSelect: CSSProperties = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent'
};

export function hudGlassPanelStyle(overrides: CSSProperties = {}): CSSProperties {
  return {
    ...glassPanel,
    color: theme.color.text,
    fontFamily: theme.font.mono,
    pointerEvents: 'none',
    userSelect: 'none',
    ...overrides
  };
}

export function hudIconButtonStyle(active = false): CSSProperties {
  return {
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    border: active ? '1px solid rgba(125,255,176,0.58)' : theme.glass.border,
    background: active
      ? 'linear-gradient(180deg, rgba(21,128,61,0.72), rgba(8,13,24,0.78))'
      : 'linear-gradient(180deg, rgba(14,22,38,0.74), rgba(6,10,18,0.66))',
    color: active ? '#c8ffd8' : theme.color.text,
    boxShadow: active
      ? '0 0 0 1px rgba(125,255,176,0.12), 0 12px 30px rgba(0,0,0,0.38)'
      : '0 10px 28px rgba(0,0,0,0.34)',
    cursor: 'pointer',
    padding: 0,
    fontFamily: theme.font.mono,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0,
    touchAction: 'manipulation',
    backdropFilter: theme.glass.blur,
    WebkitBackdropFilter: theme.glass.blur,
    ...hudNoSelect
  };
}

export function touchActionButtonStyle(primary = false): CSSProperties {
  const size = primary ? 76 : 62;
  return {
    width: size,
    height: size,
    borderRadius: theme.radius.pill,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: primary ? '1px solid rgba(125,211,252,0.72)' : theme.glass.border,
    background: primary
      ? 'radial-gradient(circle at 35% 28%, rgba(191,240,255,0.30), rgba(56,189,248,0.22) 42%, rgba(8,13,24,0.80) 100%)'
      : 'linear-gradient(180deg, rgba(14,22,38,0.78), rgba(5,8,15,0.66))',
    color: primary ? '#ecfbff' : theme.color.text,
    boxShadow: primary
      ? '0 0 0 1px rgba(125,211,252,0.14), 0 16px 38px rgba(0,0,0,0.44), 0 0 30px rgba(56,189,248,0.22)'
      : '0 12px 28px rgba(0,0,0,0.38)',
    fontFamily: theme.font.mono,
    fontSize: primary ? 12 : 11,
    fontWeight: 900,
    letterSpacing: 0,
    textShadow: '0 1px 8px rgba(0,0,0,0.72)',
    touchAction: 'none',
    pointerEvents: 'auto',
    padding: 0,
    ...hudNoSelect
  };
}

export function hudTopRightClusterStyle(): CSSProperties {
  return {
    position: 'absolute',
    top: HUD_EDGE,
    right: HUD_EDGE,
    zIndex: theme.z.hud + 5,
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    pointerEvents: 'auto'
  };
}
