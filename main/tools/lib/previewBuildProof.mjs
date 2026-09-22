import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Run from an immutable snapshot directory containing its own dist/.
// Checking the actual HTTP bytes binds the browser to that archived build.
export async function assertPreviewBuild(url, assets) {
  const expectedIndex = hash(await readFile('dist/index.html'));
  const indexResponse = await fetch(url);
  const actualIndex = hash(Buffer.from(await indexResponse.arrayBuffer()));
  if (!indexResponse.ok || actualIndex !== expectedIndex) throw new Error('Preview index differs from archived dist');
  for (const [name, expected] of Object.entries(assets)) {
    const response = await fetch(new URL(`assets/${name}`, url));
    const actual = hash(Buffer.from(await response.arrayBuffer()));
    if (!response.ok || actual !== expected) throw new Error(`Preview asset differs from archived dist: ${name}`);
  }
  return { checkedAt: new Date().toISOString(), indexSha256: actualIndex, assetsChecked: Object.keys(assets).length, matchesArchive: true };
}
