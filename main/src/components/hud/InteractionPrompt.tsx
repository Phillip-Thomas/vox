import { useEffect, useState } from 'react';
import { getInteraction, subscribeInteraction, type ActiveInteraction } from '../../game/systems/interactionSystem';
import { isTouchDevice } from '../../utils/mobileInput';

// Systemic context-interaction prompt: a single "[F] <verb>" pill under the crosshair
// that shows the CURRENT meaning of the primary interact key (open door, drink, board…),
// driven entirely by the interaction store. One component for every interaction.
// Event-driven (subscribe) — the store emits only on change, so there's no per-frame poll.
const InteractionPrompt: React.FC = () => {
  const [it, setIt] = useState<ActiveInteraction | null>(() => getInteraction());
  const touch = isTouchDevice();
  useEffect(() => {
    setIt(getInteraction()); // sync any change between render + effect
    return subscribeInteraction(() => setIt(getInteraction()));
  }, []);

  if (!it) return null;
  return (
    <div style={{
      position: 'absolute', top: 'calc(50% + 42px)', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap',
      padding: '4px 10px', borderRadius: 8,
      background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(125,211,252,0.35)',
      fontFamily: 'monospace', fontSize: 12, color: '#dfe7ee',
      textShadow: '0 1px 3px rgba(0,0,0,0.9)', pointerEvents: 'none', zIndex: 25
    }}>
      {!touch && (
        <span style={{
          padding: '1px 7px', borderRadius: 4, background: 'rgba(125,211,252,0.18)',
          border: '1px solid rgba(125,211,252,0.55)', color: '#cfe8ff', fontWeight: 700
        }}>F</span>
      )}
      <span>{it.verb}</span>
    </div>
  );
};

export default InteractionPrompt;
