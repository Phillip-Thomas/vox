import { useCallback, useEffect, useRef, useState } from 'react';
import { askVendor, aiMode } from '../../game/spaceStation/spaceStationAiClient.ts';
import { commodity, type CommodityId } from '../../game/spaceStation/spaceStationCommodities.ts';
import {
  greetingTurn,
  MAX_PLAYER_INPUT,
  sanitisePlayerInput,
  type ConversationTurn
} from '../../game/spaceStation/spaceStationConversation.ts';
import {
  commitBuy,
  commitSell,
  freeVolume,
  heldUnits,
  proposeBuy,
  proposeSell,
  refusalText,
  type TraderState
} from '../../game/spaceStation/spaceStationTrade.ts';
import type { Vendor } from '../../game/spaceStation/spaceStationVendors.ts';

/**
 * The counter: trade on the left, conversation on the right.
 *
 * Deliberately one panel rather than two screens. A vendor is a person you are
 * haggling with, and splitting "buy things" from "talk to them" into separate
 * modes is what makes a market feel like a vending machine.
 *
 * Terminal register throughout, matching the prologue and feed surfaces — mono,
 * phosphor-ish ink, no rounded chrome.
 */

const INK = 'rgba(228,236,231,0.92)';
const DIM = 'rgba(228,236,231,0.55)';
const FAINT = 'rgba(228,236,231,0.18)';
const WARM = '#ffb45a';

export interface VendorPanelProps {
  vendor: Vendor;
  trader: TraderState;
  onTrade: (next: { trader: TraderState; vendor: Vendor }) => void;
  onClose: () => void;
}

const TRADE_SIZES = [1, 10, 50];

export function VendorPanel({ vendor, trader, onTrade, onClose }: VendorPanelProps) {
  const [turns, setTurns] = useState<ConversationTurn[]>(() => [greetingTurn(vendor)]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // A different trader is a fresh conversation — but the *same* trader whose shelf
  // just changed is not. Every trade returns a new vendor object because market
  // state is immutable, so keying this on the object identity wiped the whole
  // conversation on every purchase. Keyed on the id, `vendor` is already the new
  // trader in the render where the id changed, so there is nothing stale to read.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setTurns([greetingTurn(vendor)]);
    setDraft('');
    setNotice('');
  }, [vendor.id]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [turns, pending]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = useCallback(async () => {
    const text = sanitisePlayerInput(draft);
    if (!text || pending) return;
    setDraft('');
    setPending(true);
    const asked: ConversationTurn[] = [...turns, { speaker: 'player', text }];
    setTurns(asked);

    const reply = await askVendor(vendor, turns, text);
    setTurns([
      ...asked,
      { speaker: 'vendor', text: reply.line, source: reply.source, provider: reply.provider }
    ]);
    setPending(false);
  }, [draft, pending, turns, vendor]);

  const trade = useCallback(
    (id: CommodityId, units: number, direction: 'buy' | 'sell') => {
      const proposal =
        direction === 'buy'
          ? proposeBuy(trader, vendor.market, id, units)
          : proposeSell(trader, vendor.market, id, units);

      if (proposal.units <= 0) {
        setNotice(refusalText(proposal.refusal));
        return;
      }
      const result =
        direction === 'buy'
          ? commitBuy(trader, vendor.market, proposal)
          : commitSell(trader, vendor.market, proposal);

      const moved = Math.round(proposal.units);
      const value = Math.round(proposal.total);
      setNotice(
        direction === 'buy'
          ? `bought ${moved} ${commodity(id).name} for ${value}`
          : `sold ${moved} ${commodity(id).name} for ${value}`
      );
      onTrade({ trader: result.trader, vendor: { ...vendor, market: result.market } });
    },
    [onTrade, trader, vendor]
  );

  return (
    <div style={backdrop} onClick={onClose} data-testid="spaceStation-vendor-panel">
      <div style={panel} onClick={event => event.stopPropagation()}>
        <div style={header}>
          <span>
            {vendor.designation} · <span style={{ color: WARM }}>{vendor.name}</span>
          </span>
          <span style={{ color: DIM }}>
            {Math.round(trader.credits)} credits · hold {Math.round(freeVolume(trader))}m³ free · esc to leave
          </span>
        </div>

        <div style={body}>
          {/* ---- shelf ---- */}
          <div style={column}>
            <div style={sectionLabel}>shelf</div>
            {vendor.market.lines.map(line => {
              const id = line.commodity;
              const info = commodity(id);
              const spot = proposeBuy(trader, vendor.market, id, 1).quote.spot;
              const held = heldUnits(trader, id);
              return (
                <div key={id} style={row}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{info.name}</span>
                    <span style={{ color: WARM }}>{Math.round(spot)}</span>
                  </div>
                  <div style={{ color: DIM, fontSize: 11 }}>
                    {Math.round(line.stock)} on the shelf
                    {held > 0 ? ` · you carry ${Math.round(held)}` : ''} · {info.volume}m³ each
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {TRADE_SIZES.map(size => (
                      <button key={`b${size}`} style={button} onClick={() => trade(id, size, 'buy')}>
                        buy {size}
                      </button>
                    ))}
                    {TRADE_SIZES.map(size => (
                      <button
                        key={`s${size}`}
                        style={{ ...button, opacity: held > 0 ? 1 : 0.35 }}
                        onClick={() => trade(id, size, 'sell')}
                      >
                        sell {size}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {notice && <div style={{ color: WARM, marginTop: 8, fontSize: 12 }}>{notice}</div>}
          </div>

          {/* ---- conversation ---- */}
          <div style={column}>
            <div style={sectionLabel}>
              talk <span style={{ color: DIM }}>· requested: {aiMode()}</span>
            </div>
            <div ref={logRef} style={log}>
              {turns.map((turn, index) => (
                <div key={index} style={{ marginBottom: 8 }}>
                  <div style={{ color: turn.speaker === 'player' ? DIM : INK }}>
                    {turn.speaker === 'player' ? '> ' : ''}
                    {turn.text}
                  </div>
                  {/*
                    Per-line provenance. Requesting live mode does not mean a live
                    call happened — every failure path falls back silently by
                    design, and a header that only echoes the requested mode makes
                    canned dialogue indistinguishable from inference.
                  */}
                  {turn.speaker === 'vendor' && turn.source && (
                    <div style={{ color: DIM, fontSize: 10, letterSpacing: '0.06em' }}>
                      {turn.source === 'model' ? `— ${turn.provider ?? 'model'}` : `— ${turn.source}`}
                    </div>
                  )}
                </div>
              ))}
              {pending && <div style={{ color: DIM }}>…</div>}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={inputRef}
                value={draft}
                maxLength={MAX_PLAYER_INPUT}
                placeholder="ask something"
                onChange={event => setDraft(event.target.value)}
                // Stop the walk controller eating keystrokes, exactly as the
                // prologue's name field does.
                onKeyDown={event => {
                  event.stopPropagation();
                  if (event.key === 'Enter') void send();
                }}
                onKeyUp={event => event.stopPropagation()}
                enterKeyHint="send"
                autoCapitalize="none"
                spellCheck={false}
                style={input}
              />
              <button style={button} onClick={() => void send()} disabled={pending}>
                say
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(4,6,9,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 40
};

const panel: React.CSSProperties = {
  width: 'min(880px, 92vw)',
  maxHeight: '78vh',
  background: 'rgba(8,11,14,0.96)',
  border: `1px solid ${FAINT}`,
  color: INK,
  font: '13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
  display: 'flex',
  flexDirection: 'column'
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '10px 14px',
  borderBottom: `1px solid ${FAINT}`,
  flexWrap: 'wrap'
};

const body: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
  gap: 1,
  background: FAINT,
  overflow: 'hidden',
  flex: 1
};

const column: React.CSSProperties = {
  background: 'rgba(8,11,14,0.98)',
  padding: '12px 14px',
  overflowY: 'auto',
  minHeight: 260
};

const sectionLabel: React.CSSProperties = {
  color: DIM,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontSize: 11,
  marginBottom: 10
};

const row: React.CSSProperties = {
  padding: '8px 0',
  borderBottom: `1px solid ${FAINT}`
};

const log: React.CSSProperties = {
  minHeight: 150,
  maxHeight: 260,
  overflowY: 'auto',
  marginBottom: 10,
  paddingRight: 4
};

const input: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  borderBottom: `1px solid ${FAINT}`,
  color: INK,
  font: 'inherit',
  padding: '4px 2px',
  outline: 'none'
};

const button: React.CSSProperties = {
  background: 'transparent',
  border: `1px solid ${FAINT}`,
  color: INK,
  font: 'inherit',
  fontSize: 11,
  padding: '3px 7px',
  cursor: 'pointer'
};
