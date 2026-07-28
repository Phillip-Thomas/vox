import { beforeEach, describe, expect, it } from 'vitest';
import {
  captureSnapshot,
  deleteSnapshot,
  gameStateKeys,
  isGameStateKey,
  listSnapshots,
  normaliseSnapshotName,
  readSnapshot,
  restoreSnapshot,
  restoreSnapshotByName,
  SNAPSHOT_PREFIX,
  writeSnapshot,
  type StorageLike
} from './storySnapshot.ts';

/** A localStorage stand-in with the insertion-order semantics the real one has. */
class FakeStorage implements StorageLike {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

let storage: FakeStorage;

/** A plausible mid-beat world: global save, two worlds, edits and poses. */
function seedWorld(): void {
  storage.setItem('pvx.v7.global', JSON.stringify({ milestones: ['story:ch9-settle'], era: 'emergent' }));
  storage.setItem('pvx.v7.world.29,16.structures', '[{"kind":"foundation"}]');
  storage.setItem('pvx.v7.world.29,16.pose', '{"x":1,"y":2,"z":3}');
  storage.setItem('pvx.v7.world.-19,-17.campfires', '[]');
  storage.setItem('voxel.poses', '{"a":1}');
  // Preferences — must survive a restore untouched.
  storage.setItem('paravoxia.graphics.profile', 'ULTRA');
  storage.setItem('paravoxia.audio.muted', 'true');
}

beforeEach(() => {
  storage = new FakeStorage();
});

describe('what counts as game state', () => {
  it('claims the durable game namespaces', () => {
    expect(isGameStateKey('pvx.v7.global')).toBe(true);
    expect(isGameStateKey('pvx.v7.world.29,16.structures')).toBe(true);
    expect(isGameStateKey('voxel.poses')).toBe(true);
  });

  it('leaves user preferences alone', () => {
    // Restoring a snapshot must not change someone's quality tier or unmute them.
    expect(isGameStateKey('paravoxia.graphics.profile')).toBe(false);
    expect(isGameStateKey('paravoxia.audio.muted')).toBe(false);
  });

  it('never treats a snapshot as game state, or restoring would eat the slots', () => {
    expect(isGameStateKey(`${SNAPSHOT_PREFIX}before-the-core`)).toBe(false);
  });

  it('enumerates in a stable order so two identical states compare equal', () => {
    seedWorld();
    const first = gameStateKeys(storage);
    const shuffled = new FakeStorage();
    for (const key of [...first].reverse()) shuffled.setItem(key, storage.getItem(key)!);
    expect(gameStateKeys(shuffled)).toEqual(first);
  });
});

describe('capture', () => {
  it('takes every game key and no preference keys', () => {
    seedWorld();
    const snapshot = captureSnapshot(storage, 'mid-settle', { now: 1_000, beat: 'ch9-settle' });
    expect(Object.keys(snapshot.entries).sort()).toEqual([
      'pvx.v7.global',
      'pvx.v7.world.-19,-17.campfires',
      'pvx.v7.world.29,16.pose',
      'pvx.v7.world.29,16.structures',
      'voxel.poses'
    ]);
    expect(snapshot.beat).toBe('ch9-settle');
    expect(snapshot.createdAt).toBe(1_000);
  });

  it('captures an empty world without complaining', () => {
    const snapshot = captureSnapshot(storage, 'fresh', { now: 5 });
    expect(snapshot.entries).toEqual({});
    expect(snapshot.beat).toBeNull();
  });
});

describe('restore', () => {
  it('puts the world back exactly as it was', () => {
    seedWorld();
    const snapshot = captureSnapshot(storage, 'before', { now: 1 });

    storage.setItem('pvx.v7.global', JSON.stringify({ milestones: ['story:ch9-hearth'] }));
    storage.setItem('pvx.v7.world.29,16.pose', '{"x":99,"y":99,"z":99}');

    restoreSnapshot(storage, snapshot);
    expect(JSON.parse(storage.getItem('pvx.v7.global')!).milestones).toEqual(['story:ch9-settle']);
    expect(storage.getItem('pvx.v7.world.29,16.pose')).toBe('{"x":1,"y":2,"z":3}');
  });

  it('clears state created since the snapshot rather than leaving it behind', () => {
    // The whole reason restore is not a loop of setItem. Writing over the top
    // returns you to a state that never existed.
    seedWorld();
    const snapshot = captureSnapshot(storage, 'before-the-core', { now: 1 });
    storage.setItem('pvx.v7.world.29,16.habitat', '{"core":"installed"}');

    restoreSnapshot(storage, snapshot);
    expect(storage.getItem('pvx.v7.world.29,16.habitat')).toBeNull();
  });

  it('does not disturb preferences', () => {
    seedWorld();
    const snapshot = captureSnapshot(storage, 'before', { now: 1 });
    storage.setItem('paravoxia.graphics.profile', 'POTATO');

    restoreSnapshot(storage, snapshot);
    // Still POTATO: the snapshot neither captured nor reverted it.
    expect(storage.getItem('paravoxia.graphics.profile')).toBe('POTATO');
    expect(storage.getItem('paravoxia.audio.muted')).toBe('true');
  });

  it('refuses to write outside the game namespace from a hand-edited slot', () => {
    seedWorld();
    const tampered = captureSnapshot(storage, 'tampered', { now: 1 });
    tampered.entries['paravoxia.graphics.profile'] = 'POTATO';
    tampered.entries[`${SNAPSHOT_PREFIX}other`] = 'junk';

    restoreSnapshot(storage, tampered);
    expect(storage.getItem('paravoxia.graphics.profile')).toBe('ULTRA');
    expect(storage.getItem(`${SNAPSHOT_PREFIX}other`)).toBeNull();
  });

  it('round-trips through storage', () => {
    seedWorld();
    writeSnapshot(storage, captureSnapshot(storage, 'slot-a', { now: 7, beat: 'ch9-settle' }));
    storage.setItem('pvx.v7.global', '{"milestones":[]}');

    expect(restoreSnapshotByName(storage, 'slot-a')).toBe(true);
    expect(JSON.parse(storage.getItem('pvx.v7.global')!).milestones).toEqual(['story:ch9-settle']);
  });

  it('reports a miss rather than clearing the world', () => {
    seedWorld();
    expect(restoreSnapshotByName(storage, 'never-taken')).toBe(false);
    // Critical: a typo in a slot name must not wipe the save.
    expect(storage.getItem('pvx.v7.global')).not.toBeNull();
  });
});

describe('the slot list', () => {
  it('lists newest first, because that is the one you want next', () => {
    seedWorld();
    writeSnapshot(storage, captureSnapshot(storage, 'old', { now: 100 }));
    writeSnapshot(storage, captureSnapshot(storage, 'new', { now: 900 }));
    writeSnapshot(storage, captureSnapshot(storage, 'middle', { now: 500 }));
    expect(listSnapshots(storage).map(s => s.name)).toEqual(['new', 'middle', 'old']);
  });

  it('reports size so a slot about to blow the quota is visible', () => {
    seedWorld();
    writeSnapshot(storage, captureSnapshot(storage, 'sized', { now: 1 }));
    expect(listSnapshots(storage)[0].bytes).toBeGreaterThan(50);
    expect(listSnapshots(storage)[0].keyCount).toBe(5);
  });

  it('survives a corrupt slot instead of taking the panel down', () => {
    seedWorld();
    writeSnapshot(storage, captureSnapshot(storage, 'good', { now: 1 }));
    storage.setItem(`${SNAPSHOT_PREFIX}broken`, '{not json');
    storage.setItem(`${SNAPSHOT_PREFIX}wrong-shape`, '"a string"');

    expect(readSnapshot(storage, 'broken')).toBeNull();
    expect(listSnapshots(storage).map(s => s.name)).toEqual(['good']);
  });

  it('deletes one slot without touching another', () => {
    seedWorld();
    writeSnapshot(storage, captureSnapshot(storage, 'keep', { now: 1 }));
    writeSnapshot(storage, captureSnapshot(storage, 'drop', { now: 2 }));
    deleteSnapshot(storage, 'drop');
    expect(listSnapshots(storage).map(s => s.name)).toEqual(['keep']);
  });
});

describe('slot names', () => {
  it('makes a free-text name safe as a key and readable in a list', () => {
    expect(normaliseSnapshotName('  Before The Core!  ')).toBe('before-the-core');
    expect(normaliseSnapshotName('ch9 settle / foundation')).toBe('ch9-settle-foundation');
  });

  it('never produces an empty name that would collide with the prefix', () => {
    expect(normaliseSnapshotName('')).toBe('slot');
    expect(normaliseSnapshotName('!!!')).toBe('slot');
  });

  it('strips the separator so one slot cannot shadow another', () => {
    expect(normaliseSnapshotName('a.b.c')).toBe('abc');
  });
});
