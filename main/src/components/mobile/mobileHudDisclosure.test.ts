import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeMobileHudDisclosure,
  getActiveMobileHudDisclosure,
  setActiveMobileHudDisclosure,
  subscribeMobileHudDisclosure,
  toggleMobileHudDisclosure
} from './mobileHudDisclosure.ts';

afterEach(() => closeMobileHudDisclosure());

describe('mobile HUD disclosure ownership', () => {
  it('allows only one secondary disclosure at a time', () => {
    toggleMobileHudDisclosure('suit');
    expect(getActiveMobileHudDisclosure()).toBe('suit');
    toggleMobileHudDisclosure('systems');
    expect(getActiveMobileHudDisclosure()).toBe('systems');
    toggleMobileHudDisclosure('systems');
    expect(getActiveMobileHudDisclosure()).toBeNull();
  });

  it('publishes changes and supports owner-scoped close', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMobileHudDisclosure(listener);
    setActiveMobileHudDisclosure('inventory');
    closeMobileHudDisclosure('suit');
    expect(getActiveMobileHudDisclosure()).toBe('inventory');
    closeMobileHudDisclosure('inventory');
    expect(getActiveMobileHudDisclosure()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
});
