import { describe, expect, it } from 'vitest';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import * as THREE from 'three';
import { AuditAttentionRing } from './EmergentAuditSites.tsx';

// Exercise the authored scene graph across its arrival/audit state change.
function children(element: ReactElement): ReactElement<Record<string, unknown>>[] {
  return Children.toArray((element.props as { children?: ReactNode }).children)
    .filter(isValidElement) as ReactElement<Record<string, unknown>>[];
}

describe('audit light cardinality', () => {
  it('keeps the same renderer light slot while preserving the active ring appearance', () => {
    const position = new THREE.Vector3(4, 51, -8);
    const off = AuditAttentionRing({ position, color: '#ffb36b', active: false });
    const on = AuditAttentionRing({ position, color: '#ffb36b', active: true });
    const offChildren = children(off), onChildren = children(on);
    const offLight = offChildren.find(child => child.type === 'pointLight')!;
    const onLight = onChildren.find(child => child.type === 'pointLight')!;
    expect(offLight).toBeDefined();
    expect(off.props.visible).toBeUndefined();
    expect(offLight.props.visible).toBeUndefined();
    expect(offLight.props.intensity).toBe(0);
    expect(onLight.props).toMatchObject({ intensity: 0.32, color: '#ffb36b', distance: 3.5, decay: 2, position: [0, 0.5, 0] });
    expect(offChildren.find(child => child.type === 'mesh')!.props.visible).toBe(false);
    expect(onChildren.find(child => child.type === 'mesh')!.props.visible).toBe(true);
    expect(children(onChildren.find(child => child.type === 'mesh')!)).toEqual(children(offChildren.find(child => child.type === 'mesh')!));
  });
});
