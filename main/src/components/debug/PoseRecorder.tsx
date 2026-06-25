import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getCurrentDayPhase } from '../../game/worldClock.ts';
import type { WorldCoordinate } from '../../utils/worldCoordinates.ts';

// --- Collaborative vantage recorder ------------------------------------------
//
// Lets the USER fly/walk to a good camera position+rotation during NORMAL play
// and pin it WITH A REASON, so Claude can file it into vantages.json and the
// harness (AgentCamera + tools/capture.mjs) replays it EXACTLY on the right
// world/seed. Keys (debug-only; ` chosen so gameplay keys like C stay free):
//   `  -> pin: prompts for a reason / thing-of-interest, records the exact world-
//         space camera pose + the current WORLD COORDINATE (= seed) + dayphase.
//   V  -> copy ALL pinned vantages to the clipboard as JSON (paste to Claude).
// Pins also accumulate on window.__poses + localStorage. A toast confirms each
// (driven by the 'vantage:pinned' / 'vantage:copied' window events; see App).

const round = (n: number, d = 3) => Number(n.toFixed(d));
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'vantage';

interface PoseRecorderProps {
  coordinate: WorldCoordinate;
}

export default function PoseRecorder({ coordinate }: PoseRecorderProps) {
  const camera = useThree(state => state.camera);

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[poses] ` = pin a vantage (with reason)   V = copy all pins to clipboard');
    const w = window as unknown as { __poses?: unknown[] };

    const onKey = (event: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;

      if (event.code === 'Backquote') {
        // (Pointer lock is auto-released while the prompt is open; click to re-lock.)
        const reason = window.prompt('Pin vantage — reason / thing of interest:', '');
        if (reason === null) return; // cancelled
        camera.updateMatrixWorld(true);
        const p = camera.getWorldPosition(new THREE.Vector3());
        const q = camera.getWorldQuaternion(new THREE.Quaternion());
        const entry = {
          name: `${coordinate.x}_${coordinate.y}-${slug(reason)}`,
          world: [coordinate.x, coordinate.y] as [number, number],
          day: Number(getCurrentDayPhase().toFixed(4)),
          pos: [round(p.x), round(p.y), round(p.z)] as [number, number, number],
          quat: [round(q.x, 4), round(q.y, 4), round(q.z, 4), round(q.w, 4)] as [number, number, number, number],
          reason: reason.trim()
        };
        (w.__poses ||= []).push(entry);
        try { localStorage.setItem('voxel.poses', JSON.stringify(w.__poses)); } catch { /* ignore */ }
        // eslint-disable-next-line no-console
        console.log('[vantage]', JSON.stringify(entry));
        window.dispatchEvent(new CustomEvent('vantage:pinned', {
          detail: { reason: entry.reason || entry.name, count: w.__poses.length }
        }));
      }

      if (event.code === 'KeyV') {
        const poses = w.__poses ?? [];
        const json = JSON.stringify(poses, null, 2);
        const done = () => window.dispatchEvent(new CustomEvent('vantage:copied', { detail: { count: poses.length } }));
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(json).then(done).catch(() => {
            // eslint-disable-next-line no-console
            console.log('[poses] clipboard blocked; copy from here:\n', json);
            done();
          });
        } else {
          // eslint-disable-next-line no-console
          console.log('[poses] copy from here:\n', json);
          done();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [camera, coordinate.x, coordinate.y]);

  return null;
}
