import React, { useEffect, useMemo, useState } from 'react';
import { theme } from '../../ui/theme.ts';
import {
  createCoopRoom,
  disconnectCoopRoom,
  getMultiplayerSessionSnapshot,
  joinCoopRoom,
  resolveMultiplayerConfig,
  subscribeMultiplayerSession,
  type MultiplayerSessionSnapshot,
  type MultiplayerSessionStatus
} from '../../game/multiplayerSession.ts';

interface CoopPanelProps {
  startWorldId: string;
}

const busyStatuses = new Set<MultiplayerSessionStatus>(['signing_in', 'connecting', 'authenticating', 'creating', 'joining', 'reconnecting']);

const CoopPanel: React.FC<CoopPanelProps> = ({ startWorldId }) => {
  const [snapshot, setSnapshot] = useState<MultiplayerSessionSnapshot>(() => getMultiplayerSessionSnapshot());
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const config = useMemo(() => resolveMultiplayerConfig(), []);
  const busy = busyStatuses.has(snapshot.status);
  const connected = snapshot.status === 'connected' || snapshot.status === 'closed';
  const canUseCoop = config.ok && !busy;
  const status = statusCopy(snapshot, config.reason);

  useEffect(() => subscribeMultiplayerSession(() => setSnapshot(getMultiplayerSessionSnapshot())), []);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const createRoom = () => {
    if (!canUseCoop) return;
    void createCoopRoom(startWorldId);
  };

  const joinRoom = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canUseCoop || !joinCode.trim()) return;
    void joinCoopRoom(joinCode);
  };

  const copyInvite = () => {
    if (!snapshot.inviteCode || !navigator.clipboard) return;
    void navigator.clipboard.writeText(snapshot.inviteCode).then(() => setCopied(true));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div>
          <PanelTitle>Co-op Alpha</PanelTitle>
          <div style={{ color: theme.color.textDim, fontSize: 12, lineHeight: 1.45 }}>
            Authenticated rooms for invited play.
          </div>
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>

      {snapshot.error && (
        <div style={{ color: theme.color.danger, fontSize: 12, lineHeight: 1.45 }}>
          {snapshot.error}
        </div>
      )}

      {!config.ok && !snapshot.error && (
        <div style={{ color: theme.color.textDim, fontSize: 12, lineHeight: 1.45 }}>
          {configMessage(config.reason)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        <button
          onClick={createRoom}
          disabled={!canUseCoop}
          style={primaryButton(!canUseCoop)}
        >
          {busy && snapshot.status !== 'joining' ? 'Opening room...' : 'Create room'}
        </button>

        <form onSubmit={joinRoom} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }}>
          <input
            value={joinCode}
            onChange={event => setJoinCode(event.target.value.toUpperCase())}
            placeholder="Invite code"
            aria-label="Invite code"
            disabled={!config.ok || busy}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={!canUseCoop || !joinCode.trim()}
            style={secondaryButton(!canUseCoop || !joinCode.trim())}
          >
            Join
          </button>
        </form>
      </div>

      {connected && (
        <div style={{ display: 'grid', gap: 7, fontSize: 12, color: theme.color.textDim }}>
          <InfoRow label="Room" value={snapshot.roomId ?? 'pending'} />
          <InfoRow label="World" value={snapshot.worldId ?? startWorldId} />
          {snapshot.inviteCode && (
            <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 8, alignItems: 'center' }}>
              <span style={infoLabel}>Invite</span>
              <code style={codeValue}>{snapshot.inviteCode}</code>
              <button onClick={copyInvite} style={miniButton}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}
          <button onClick={disconnectCoopRoom} style={quietButton}>Disconnect</button>
        </div>
      )}
    </div>
  );
};

const PanelTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    fontSize: 11,
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: theme.color.accent,
    marginBottom: 6
  }}>
    {children}
  </div>
);

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: 8 }}>
    <span style={infoLabel}>{label}</span>
    <code style={codeValue}>{value}</code>
  </div>
);

const StatusPill: React.FC<{ tone: 'idle' | 'good' | 'warn' | 'busy'; children: React.ReactNode }> = ({ tone, children }) => {
  const color = tone === 'good'
    ? theme.color.good
    : tone === 'warn'
      ? theme.color.danger
      : theme.color.accent;
  return (
    <span style={{
      flex: '0 0 auto',
      fontFamily: theme.font.mono,
      fontSize: 10,
      letterSpacing: '0.08em',
      color,
      border: `1px solid ${color}`,
      borderRadius: theme.radius.pill,
      padding: '4px 8px',
      background: 'rgba(5,8,15,0.38)'
    }}>
      {children}
    </span>
  );
};

function statusCopy(
  snapshot: MultiplayerSessionSnapshot,
  configReason: ReturnType<typeof resolveMultiplayerConfig>['reason']
): { label: string; tone: 'idle' | 'good' | 'warn' | 'busy' } {
  if (snapshot.status === 'error') return { label: 'Error', tone: 'warn' };
  if (snapshot.status === 'connected') return { label: 'Linked', tone: 'good' };
  if (snapshot.status === 'reconnecting') return { label: 'Rejoining', tone: 'busy' };
  if (snapshot.status === 'closed') return { label: 'Closed', tone: 'warn' };
  if (busyStatuses.has(snapshot.status)) return { label: 'Opening', tone: 'busy' };
  if (configReason === 'ready') return { label: 'Ready', tone: 'idle' };
  return { label: 'Offline', tone: 'warn' };
}

function configMessage(reason: ReturnType<typeof resolveMultiplayerConfig>['reason']): string {
  switch (reason) {
    case 'disabled':
      return 'Set VITE_PARAVOXIA_COOP=1 to show this alpha path.';
    case 'missing_firebase_config':
      return 'Firebase web app config is required for anonymous sign-in.';
    case 'missing_state_server_url':
      return 'Set VITE_PARAVOXIA_STATE_SERVER_URL to the state server.';
    case 'ready':
      return '';
  }
}

const inputStyle: React.CSSProperties = {
  minWidth: 0,
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 11px',
  color: theme.color.text,
  background: 'rgba(5,8,15,0.46)',
  border: '1px solid rgba(125,211,252,0.26)',
  borderRadius: theme.radius.sm,
  fontFamily: theme.font.mono,
  fontSize: 12,
  outline: 'none'
};

function primaryButton(disabled: boolean): React.CSSProperties {
  return {
    width: '100%',
    fontFamily: theme.font.ui,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.06em',
    color: disabled ? theme.color.textFaint : theme.color.void,
    background: disabled
      ? 'rgba(125,211,252,0.10)'
      : `linear-gradient(180deg, ${theme.color.accent}, ${theme.color.accentStrong})`,
    border: 'none',
    borderRadius: theme.radius.sm,
    padding: '11px 14px',
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: disabled ? 'none' : '0 8px 24px rgba(56,189,248,0.28)'
  };
}

function secondaryButton(disabled: boolean): React.CSSProperties {
  return {
    fontFamily: theme.font.ui,
    fontSize: 12,
    fontWeight: 700,
    color: disabled ? theme.color.textFaint : theme.color.accent,
    background: 'rgba(5,8,15,0.36)',
    border: `1px solid ${disabled ? 'rgba(125,211,252,0.12)' : 'rgba(125,211,252,0.36)'}`,
    borderRadius: theme.radius.sm,
    padding: '9px 13px',
    cursor: disabled ? 'default' : 'pointer'
  };
}

const miniButton: React.CSSProperties = {
  fontFamily: theme.font.ui,
  fontSize: 11,
  color: theme.color.accent,
  background: 'rgba(125,211,252,0.08)',
  border: '1px solid rgba(125,211,252,0.24)',
  borderRadius: theme.radius.sm,
  padding: '5px 8px',
  cursor: 'pointer'
};

const quietButton: React.CSSProperties = {
  justifySelf: 'start',
  fontFamily: theme.font.ui,
  fontSize: 12,
  color: theme.color.textDim,
  background: 'transparent',
  border: 'none',
  padding: '4px 0',
  cursor: 'pointer'
};

const infoLabel: React.CSSProperties = {
  fontFamily: theme.font.mono,
  color: theme.color.accent,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.08em'
};

const codeValue: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: theme.color.text,
  fontFamily: theme.font.mono,
  fontSize: 11
};

export default CoopPanel;
