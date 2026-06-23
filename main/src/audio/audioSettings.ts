import { useSyncExternalStore } from 'react';

export interface AudioSettingsSnapshot {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

const VOLUME_KEY = 'paravoxia.audio.musicVolume';
const SFX_VOLUME_KEY = 'paravoxia.audio.sfxVolume';
const MUTED_KEY = 'paravoxia.audio.muted';

const DEFAULT_SETTINGS: AudioSettingsSnapshot = {
  musicVolume: 0.72,
  sfxVolume: 0.78,
  muted: false
};

let snapshot = readStoredSettings();
const listeners = new Set<() => void>();

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS.musicVolume;
  return Math.min(1, Math.max(0, value));
}

function readStoredSettings(): AudioSettingsSnapshot {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const rawVolume = window.localStorage.getItem(VOLUME_KEY);
    const rawSfxVolume = window.localStorage.getItem(SFX_VOLUME_KEY);
    const rawMuted = window.localStorage.getItem(MUTED_KEY);
    return {
      musicVolume: rawVolume === null ? DEFAULT_SETTINGS.musicVolume : clamp01(Number(rawVolume)),
      sfxVolume: rawSfxVolume === null ? DEFAULT_SETTINGS.sfxVolume : clamp01(Number(rawSfxVolume)),
      muted: rawMuted === null ? DEFAULT_SETTINGS.muted : rawMuted === 'true'
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(next: AudioSettingsSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOLUME_KEY, String(next.musicVolume));
    window.localStorage.setItem(SFX_VOLUME_KEY, String(next.sfxVolume));
    window.localStorage.setItem(MUTED_KEY, String(next.muted));
  } catch {
    // Storage can be unavailable in hardened/private contexts.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AudioSettingsSnapshot {
  return snapshot;
}

function setSnapshot(patch: Partial<AudioSettingsSnapshot>): void {
  const next = { ...snapshot, ...patch };
  if (
    next.musicVolume === snapshot.musicVolume &&
    next.sfxVolume === snapshot.sfxVolume &&
    next.muted === snapshot.muted
  ) {
    return;
  }
  snapshot = next;
  persistSettings(snapshot);
  emit();
}

export function useAudioSettings(): AudioSettingsSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getAudioSettingsSnapshot(): AudioSettingsSnapshot {
  return snapshot;
}

export function setMusicVolume(value: number): void {
  setSnapshot({ musicVolume: clamp01(value) });
}

export function setSfxVolume(value: number): void {
  setSnapshot({ sfxVolume: clamp01(value) });
}

export function setMusicMuted(muted: boolean): void {
  setSnapshot({ muted });
}
