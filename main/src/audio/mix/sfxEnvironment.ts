let environment = { station: false, interior: false };
/** Physical room authority; environment transitions never change progression. */
export function setSfxEnvironment(next: Partial<typeof environment>): void { environment = { ...environment, ...next }; }
export function getSfxEnvironment(): Readonly<typeof environment> { return environment; }
