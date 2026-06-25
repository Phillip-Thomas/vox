import React, { useEffect, useState } from 'react';
import { theme } from '../../ui/theme.ts';
import {
  getMultiplayerSessionSnapshot,
  subscribeMultiplayerSession,
  type MultiplayerSessionSnapshot
} from '../../game/multiplayerSession.ts';

const MultiplayerStatusBadge: React.FC = () => {
  const [snapshot, setSnapshot] = useState<MultiplayerSessionSnapshot>(() => getMultiplayerSessionSnapshot());

  useEffect(() => subscribeMultiplayerSession(() => setSnapshot(getMultiplayerSessionSnapshot())), []);

  if (!shouldShow(snapshot)) return null;
  const tone = snapshot.status === 'connected' ? theme.color.good : snapshot.status === 'error' ? theme.color.danger : theme.color.accent;
  const label = snapshot.status === 'connected'
    ? `Co-op ${snapshot.inviteCode ?? snapshot.roomId ?? ''}`
    : snapshot.status === 'error'
      ? 'Co-op error'
      : `Co-op ${snapshot.status}`;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: theme.z.hud,
        maxWidth: 'min(86vw, 340px)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontFamily: theme.font.mono,
        fontSize: 11,
        letterSpacing: '0.08em',
        color: tone,
        background: 'rgba(5,8,15,0.58)',
        border: `1px solid ${tone}`,
        borderRadius: theme.radius.pill,
        padding: '6px 11px',
        backdropFilter: theme.glass.blur,
        WebkitBackdropFilter: theme.glass.blur,
        pointerEvents: 'none'
      }}
    >
      {label}
    </div>
  );
};

function shouldShow(snapshot: MultiplayerSessionSnapshot): boolean {
  return snapshot.status !== 'offline'
    && snapshot.status !== 'disabled'
    && snapshot.status !== 'config_missing';
}

export default MultiplayerStatusBadge;
