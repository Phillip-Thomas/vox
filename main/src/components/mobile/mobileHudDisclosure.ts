export type MobileHudDisclosure = 'suit' | 'inventory' | 'systems' | 'story-debug';

let activeDisclosure: MobileHudDisclosure | null = null;
const listeners = new Set<() => void>();

export function getActiveMobileHudDisclosure(): MobileHudDisclosure | null {
  return activeDisclosure;
}

export function subscribeMobileHudDisclosure(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setActiveMobileHudDisclosure(next: MobileHudDisclosure | null): void {
  if (activeDisclosure === next) return;
  activeDisclosure = next;
  for (const listener of listeners) listener();
}

export function toggleMobileHudDisclosure(panel: MobileHudDisclosure): void {
  setActiveMobileHudDisclosure(activeDisclosure === panel ? null : panel);
}

export function closeMobileHudDisclosure(panel?: MobileHudDisclosure): void {
  if (panel && activeDisclosure !== panel) return;
  setActiveMobileHudDisclosure(null);
}
