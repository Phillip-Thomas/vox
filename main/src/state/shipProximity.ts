// Whether the player is close enough to board the parked ship. SpaceshipPlaceholder
// owns the proximity test (it has the ship's world position) and publishes the result
// here; the on-foot interaction resolver (EfficientPlayer) reads it as the "board"
// candidate. Module-singleton bool — no React churn.

let boardable = false;

export function setBoardable(value: boolean): void { boardable = value; }
export function isBoardable(): boolean { return boardable; }
