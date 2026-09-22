// A probe owns a build snapshot as well as a port. Vite empties/replaces dist
// during another build; serving it directly can change the app between frames.
import { constants, cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const bytesHash = bytes => createHash('sha256').update(bytes).digest('hex');

export function previewBuildManifest(directory) {
  const files = {};
  const visit = (relative = '') => {
    for (const name of readdirSync(join(directory, relative)).sort()) {
      const path = join(relative, name), stat = lstatSync(join(directory, path));
      if (stat.isSymbolicLink()) throw new Error(`Preview build contains a mutable symlink: ${path}`);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files[path] = bytesHash(readFileSync(join(directory, path)));
      else throw new Error(`Preview build contains a non-file entry: ${path}`);
    }
  };
  visit();
  if (!files['index.html']) throw new Error('Preview build is missing index.html');
  return { files, sha256: bytesHash(JSON.stringify(files)) };
}

export function snapshotPreviewBuild(source = resolve('dist')) {
  const before = previewBuildManifest(source);
  const owned = mkdtempSync(join(tmpdir(), 'paravoxia-preview-'));
  const directory = join(owned, 'dist');
  const cleanup = () => rmSync(owned, { recursive: true, force: true });
  try {
    mkdirSync(directory);
    cpSync(source, directory, { recursive: true, mode: constants.COPYFILE_FICLONE });
    const copied = previewBuildManifest(directory);
    const after = previewBuildManifest(source);
    if (before.sha256 !== copied.sha256 || before.sha256 !== after.sha256) {
      throw new Error('Preview build changed while snapshotting; rebuild and retry the probe');
    }
    return { directory, manifest: copied, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
