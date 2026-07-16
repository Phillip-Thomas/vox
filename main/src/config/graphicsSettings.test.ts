import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROFILE,
  QUALITY_PROFILE_STORAGE_KEY,
  environmentResolutionForProfile,
  getQualityProfile,
  isSoftwareWebGLRenderer,
  parseQualityProfile,
  readPersistedQualityProfile,
  resolveQualityProfileSelection,
  setQualityProfile,
  subscribeGraphicsQuality,
  type QualityProfileStorage
} from './graphicsSettings.ts';

class MemoryStorage implements QualityProfileStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

afterEach(() => {
  setQualityProfile(DEFAULT_PROFILE, { persist: false });
});

describe('graphics quality profile selection', () => {
  it('accepts known profiles case-insensitively and rejects malformed values', () => {
    expect(parseQualityProfile(' low ')).toBe('LOW');
    expect(parseQualityProfile('POTATO')).toBe('POTATO');
    expect(parseQualityProfile('cinematic')).toBeNull();
    expect(parseQualityProfile(null)).toBeNull();
  });

  it('gives an explicit URL profile precedence over storage, then falls back safely', () => {
    expect(resolveQualityProfileSelection('MEDIUM', 'LOW')).toEqual({
      profile: 'MEDIUM',
      source: 'url'
    });
    expect(resolveQualityProfileSelection(null, 'low')).toEqual({
      profile: 'LOW',
      source: 'storage'
    });
    expect(resolveQualityProfileSelection('invalid', 'also-invalid')).toEqual({
      profile: DEFAULT_PROFILE,
      source: 'default'
    });
  });

  it('persists player choices but permits non-persistent automatic changes', () => {
    const storage = new MemoryStorage();
    const listener = vi.fn();
    const unsubscribe = subscribeGraphicsQuality(listener);

    setQualityProfile('LOW', { storage });
    expect(storage.getItem(QUALITY_PROFILE_STORAGE_KEY)).toBe('LOW');
    expect(readPersistedQualityProfile(storage)).toBe('LOW');
    expect(getQualityProfile()).toBe('LOW');

    setQualityProfile('POTATO', { persist: false, storage });
    expect(storage.getItem(QUALITY_PROFILE_STORAGE_KEY)).toBe('LOW');
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('tolerates storage-denied browser shells', () => {
    const denied: QualityProfileStorage = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); }
    };
    expect(readPersistedQualityProfile(denied)).toBeNull();
    expect(() => setQualityProfile('MEDIUM', { storage: denied })).not.toThrow();
  });
});

describe('graphics renderer safety rails', () => {
  it('only identifies clear software renderer signatures', () => {
    expect(isSoftwareWebGLRenderer('ANGLE (Google, Vulkan 1.3 SwiftShader Device)')).toBe(true);
    expect(isSoftwareWebGLRenderer('llvmpipe (LLVM 17.0.6, 256 bits)')).toBe(true);
    expect(isSoftwareWebGLRenderer('Mesa software rasterizer')).toBe(true);
    expect(isSoftwareWebGLRenderer('ANGLE (NVIDIA GeForce RTX 4070)')).toBe(false);
    expect(isSoftwareWebGLRenderer(null)).toBe(false);
  });

  it('removes environment readback on low tiers while retaining higher-tier IBL', () => {
    expect(environmentResolutionForProfile('ULTRA')).toBe(256);
    expect(environmentResolutionForProfile('HIGH')).toBe(256);
    expect(environmentResolutionForProfile('MEDIUM')).toBe(128);
    expect(environmentResolutionForProfile('LOW')).toBeNull();
    expect(environmentResolutionForProfile('POTATO')).toBeNull();
  });
});
