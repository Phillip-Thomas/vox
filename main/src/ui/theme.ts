// Shared design tokens for the Paravoxia UI — "elevated sci-fi": deep navy/black,
// cyan accent, glassmorphism, soft glow. UI text in a clean sans; telemetry stays
// monospace. Import these instead of hand-rolling inline colors so every surface
// reads as one system.

export const theme = {
  color: {
    void: '#05080f',
    bg0: '#070b14',
    bg1: '#0b1322',
    text: '#e6eef7',
    textDim: 'rgba(207,224,255,0.64)',
    textFaint: 'rgba(207,224,255,0.40)',
    accent: '#7dd3fc',
    accentStrong: '#38bdf8',
    accentSoft: 'rgba(125,211,252,0.5)',
    accentGhost: 'rgba(125,211,252,0.12)',
    good: '#7dffb0',
    danger: '#fca5a5'
  },
  glass: {
    background: 'rgba(10,16,28,0.55)',
    backgroundStrong: 'rgba(8,13,24,0.78)',
    border: '1px solid rgba(125,211,252,0.22)',
    blur: 'blur(14px) saturate(120%)',
    shadow: '0 12px 40px rgba(0,0,0,0.45)'
  },
  radius: { sm: 8, md: 12, lg: 18, pill: 999 },
  font: {
    ui: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
  },
  transition: {
    base: '180ms cubic-bezier(0.4,0,0.2,1)',
    slow: '450ms cubic-bezier(0.4,0,0.2,1)',
    reveal: '750ms cubic-bezier(0.22,1,0.36,1)'
  },
  // z-index bands: canvas at the bottom, then HUD, menus, loading cover, toasts.
  z: { canvas: 0, hud: 20, menu: 60, loading: 80, toast: 95 }
} as const;

import type { CSSProperties } from 'react';

/** A frosted-glass panel surface. */
export const glassPanel: CSSProperties = {
  background: theme.glass.background,
  border: theme.glass.border,
  borderRadius: theme.radius.lg,
  backdropFilter: theme.glass.blur,
  WebkitBackdropFilter: theme.glass.blur,
  boxShadow: theme.glass.shadow
};
