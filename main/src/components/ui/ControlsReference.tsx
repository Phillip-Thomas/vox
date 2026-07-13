import React from 'react';
import { theme } from '../../ui/theme.ts';
import {
  createControlsReference,
  type ControlsReferenceContext
} from './ControlsReference.model.ts';

interface ControlsReferenceProps {
  context: ControlsReferenceContext;
  labelledBy?: string;
}

const ControlsReference: React.FC<ControlsReferenceProps> = ({ context, labelledBy }) => {
  const sections = createControlsReference(context);
  return (
    <div
      aria-labelledby={labelledBy}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))',
        gap: '16px 22px',
        maxHeight: 'min(55vh, 520px)',
        overflowY: 'auto',
        paddingRight: 4
      }}
    >
      {sections.map(section => (
        <section key={section.id} aria-label={section.title}>
          <div style={{
            marginBottom: 7,
            fontFamily: theme.font.mono,
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: section.title.includes('current') ? theme.color.good : theme.color.textFaint
          }}>
            {section.title}
          </div>
          <div style={{ display: 'grid', gap: 5 }}>
            {section.actions.map(action => (
              <div key={`${section.id}-${action.key}-${action.label}`} style={{
                display: 'grid', gridTemplateColumns: 'minmax(74px, auto) 1fr',
                alignItems: 'baseline', gap: 12, minWidth: 0, fontSize: 12
              }}>
                <span style={{
                  justifySelf: 'start', padding: '2px 6px', borderRadius: 5,
                  border: '1px solid rgba(125,211,252,0.22)',
                  background: 'rgba(125,211,252,0.08)',
                  fontFamily: theme.font.mono, fontSize: 10, color: theme.color.accent,
                  whiteSpace: 'nowrap'
                }}>
                  {action.key}
                </span>
                <span style={{ color: theme.color.textDim, lineHeight: 1.4 }}>{action.label}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default ControlsReference;
