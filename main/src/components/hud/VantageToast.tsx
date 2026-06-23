import React, { useEffect, useState } from 'react';

/**
 * Brief confirmation toast for the vantage recorder (PoseRecorder): shows when a
 * vantage is pinned (`) or all pins are copied (V). Debug-only aid.
 */
const VantageToast: React.FC = () => {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const show = (text: string) => {
      setMsg(text);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2200);
    };
    const onPinned = (e: Event) => {
      const d = (e as CustomEvent).detail as { reason: string; count: number };
      show(`📌 Pinned (${d.count}): ${d.reason}`);
    };
    const onCopied = (e: Event) => {
      const d = (e as CustomEvent).detail as { count: number };
      show(`📋 Copied ${d.count} vantage${d.count === 1 ? '' : 's'} to clipboard`);
    };
    window.addEventListener('vantage:pinned', onPinned);
    window.addEventListener('vantage:copied', onCopied);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('vantage:pinned', onPinned);
      window.removeEventListener('vantage:copied', onCopied);
    };
  }, []);

  if (!msg) return null;
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.78)',
      color: '#9effa1',
      fontFamily: 'monospace',
      fontSize: 13,
      padding: '8px 14px',
      borderRadius: 8,
      border: '1px solid rgba(158,255,161,0.4)',
      pointerEvents: 'none',
      zIndex: 30,
      maxWidth: '80vw',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }}>
      {msg}
    </div>
  );
};

export default VantageToast;
