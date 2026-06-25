// Whether the player is close enough to board the parked ship. SpaceshipPlaceholder
// owns the proximity test (it has the ship's world position) and publishes the result
// here; the on-foot interaction resolver (EfficientPlayer) reads it as the "board"
// candidate. The HUD also reads the parked ship position for scanner/minimap markers.

let boardable = false;
let shipPosition: [number, number, number] | null = null;
const listeners = new Set<() => void>();

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

function emit(): void {
  listeners.forEach(listener => listener());
}

function samePosition(a: [number, number, number] | null, b: [number, number, number] | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < 0.0001
    && Math.abs(a[1] - b[1]) < 0.0001
    && Math.abs(a[2] - b[2]) < 0.0001;
}

function finite(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function subscribeShipProximity(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setBoardable(value: boolean): void {
  if (boardable === value) return;
  boardable = value;
  emit();
}

export function isBoardable(): boolean { return boardable; }

export function setShipPosition(value: Vec3Like | readonly [number, number, number] | null): void {
  let next: [number, number, number] | null = null;
  if (value != null) {
    if (Array.isArray(value)) {
      const tuple = value as readonly [number, number, number];
      next = [finite(tuple[0]), finite(tuple[1]), finite(tuple[2])];
    } else {
      const vec = value as Vec3Like;
      next = [finite(vec.x), finite(vec.y), finite(vec.z)];
    }
  }
  if (samePosition(shipPosition, next)) return;
  shipPosition = next;
  emit();
}

export function getShipPosition(): [number, number, number] | null {
  return shipPosition ? [...shipPosition] : null;
}
