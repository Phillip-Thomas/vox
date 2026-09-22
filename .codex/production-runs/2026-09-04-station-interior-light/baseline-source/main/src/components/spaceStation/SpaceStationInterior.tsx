import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildSpaceStationArchitecture } from '../../game/spaceStation/spaceStationArchitecture.ts';
import { buildSpaceStationDressing } from '../../game/spaceStation/spaceStationDressing.ts';
import {
  buildSpaceStationShell,
  defaultStyleForKind,
  SURFACE_STYLE,
  type SpaceStationBox
} from '../../game/spaceStation/spaceStationShell.ts';
import type { SpaceStationDescriptor, CellId } from '../../game/spaceStation/spaceStationTypes.ts';
import { visibleCells } from '../../game/spaceStation/portalGraph.ts';
import { createStationMaterial, createStationTrimMaterial } from './stationMaterial.ts';

/**
 * SpaceStation interior: shell architecture plus dressing, culled by the portal graph.
 *
 * Two instanced draws for the entire structure. Surfaces share one standard material
 * and vary by instance colour; lamps are a second unlit pass so they read as light
 * sources rather than as bright paint. Cells the portal walk cannot reach contribute
 * no instances at all, so cost tracks what is visible rather than what exists.
 */

/**
 * Structural tones. Desaturated so the lamps carry all the colour, but not dark —
 * a near-black albedo reflects almost nothing no matter how well a room is lit, and
 * reading "the scene is too dim" as a lighting problem when it is a paint problem
 * costs a lot of pointless light tuning.
 */
const SURFACE_TONES = [
  0x585f67, // 0 floor
  0x1c1f23, // 1 ceiling — stays dark, it is meant to vanish upward
  0x666d76, // 2 walls and columns
  0x8a7c64, // 3 trim, frames, rails, racking
  0x9c8757, // 4 crates
  0x5c646d, // 5 desks and counters
  0x717881, // 6 partitions, booth backs, kiosks
  // Awnings, banners and sign boards. The only saturated surfaces in the station,
  // and they belong to the traders — the administration paints nothing.
  0x9a5f4a, // 7 rust
  0x4f6b6a, // 8 teal
  0x7a6a94 // 9 violet
].map(hex => new THREE.Color(hex));

/** Warm desk lamps against cool overhead strips — the only colour in the place. */
const LAMP_TONES = [
  0xffb45a, // 0 desk lamp, sodium
  0x9fd8ff // 1 ceiling strip, work light
].map(hex => new THREE.Color(hex));

export interface SpaceStationInteriorDiagnostics {
  worldId: string;
  cellCount: number;
  visibleCellCount: number;
  visibleCellIds: string[];
  occupiedCellId: string | null;
  instances: number;
  totalInstances: number;
  /** Meshes this component submits. See the note where this is populated. */
  meshes: number;
  /** Compiled shader programs in the renderer, scene plus post chain. */
  programs: number;
}

let latestDiagnostics: SpaceStationInteriorDiagnostics | null = null;
let latestVisibleCells: ReadonlySet<CellId> = new Set();

/** Read by capture harnesses and the sandbox HUD. Never drives rendering. */
export function spaceStationInteriorDiagnostics(): SpaceStationInteriorDiagnostics | null {
  return latestDiagnostics;
}

/**
 * The cells the portal walk reached on the most recent frame.
 *
 * Other systems (the crowd) cull against this rather than recomputing it. They read
 * whatever the last frame produced, which avoids any dependency on component mount
 * order — one frame of latency is invisible for deciding whether to draw a figure.
 */
export function currentVisibleCells(): ReadonlySet<CellId> {
  return latestVisibleCells;
}

export interface SpaceStationInteriorProps {
  descriptor: SpaceStationDescriptor;
  /** Cell the viewer currently stands in, from the locomotion state. */
  occupiedCellId: CellId | null;
}

export function SpaceStationInterior({ descriptor, occupiedCellId }: SpaceStationInteriorProps) {
  const surfaceRef = useRef<THREE.InstancedMesh>(null);
  const lampRef = useRef<THREE.InstancedMesh>(null);
  const graph = descriptor.graph;

  const { surfacesByCell, lampsByCell, surfaceCapacity, lampCapacity } = useMemo(() => {
    const all = [
      ...buildSpaceStationShell(graph),
      ...buildSpaceStationArchitecture(graph, descriptor.seed),
      ...buildSpaceStationDressing(graph, descriptor.seed)
    ];
    const surfaces = new Map<string, SpaceStationBox[]>();
    const lamps = new Map<string, SpaceStationBox[]>();

    for (const box of all) {
      const key = box.cellId ?? '';
      // Tones 7-9 are the traders' awnings and banners. They are 'prop' by kind but
      // must not be panelled like a crate, so they resolve to the fabric treatment.
      if (box.style === undefined && box.tone >= 7) box.style = SURFACE_STYLE.fabric;
      const target = box.kind === 'lamp' ? lamps : surfaces;
      const existing = target.get(key);
      if (existing) existing.push(box);
      else target.set(key, [box]);
    }

    const total = (map: Map<string, SpaceStationBox[]>) =>
      [...map.values()].reduce((sum, list) => sum + list.length, 0);

    return {
      surfacesByCell: surfaces,
      lampsByCell: lamps,
      surfaceCapacity: Math.max(1, total(surfaces)),
      lampCapacity: Math.max(1, total(lamps))
    };
  }, [graph, descriptor.seed]);

  // One material instance for the whole station, disposed with the component.
  // A second instance would be a second shader program for no visual gain.
  const surfaceMaterial = useMemo(() => createStationMaterial(), []);
  const trimMaterial = useMemo(() => createStationTrimMaterial(), []);
  useEffect(
    () => () => {
      surfaceMaterial.dispose();
      trimMaterial.dispose();
    },
    [surfaceMaterial, trimMaterial]
  );

  // Per-instance surface family, uploaded once and re-packed alongside the matrices.
  const styleAttribute = useMemo(
    () => new THREE.InstancedBufferAttribute(new Float32Array(surfaceCapacity), 1),
    [surfaceCapacity]
  );

  const scratch = useMemo(
    () => ({
      viewProjection: new THREE.Matrix4(),
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      scale: new THREE.Vector3()
    }),
    []
  );

  const lastOccupied = useRef<CellId | null>(occupiedCellId);

  useEffect(() => () => {
    latestDiagnostics = null;
  }, []);

  useFrame(({ camera, gl }) => {
    const surfaceMesh = surfaceRef.current;
    const lampMesh = lampRef.current;
    if (!surfaceMesh || !lampMesh) return;

    const occupied = occupiedCellId ?? lastOccupied.current;
    lastOccupied.current = occupied;

    let visible: Set<CellId>;
    if (occupied) {
      scratch.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      visible = visibleCells(graph, occupied, scratch.viewProjection.elements);
    } else {
      visible = new Set(graph.cells.filter(cell => cell.enterable).map(cell => cell.id));
    }

    const pack = (
      mesh: THREE.InstancedMesh,
      source: Map<string, SpaceStationBox[]>,
      palette: THREE.Color[],
      styles: THREE.InstancedBufferAttribute | null
    ): number => {
      let index = 0;
      for (const cellId of visible) {
        const boxes = source.get(cellId);
        if (!boxes) continue;
        for (const box of boxes) {
          if (styles) styles.setX(index, box.style ?? defaultStyleForKind(box.kind));
          scratch.position.set(box.center[0], box.center[1], box.center[2]);
          scratch.quaternion.identity();
          scratch.scale.set(box.size[0], box.size[1], box.size[2]);
          scratch.matrix.compose(scratch.position, scratch.quaternion, scratch.scale);
          mesh.setMatrixAt(index, scratch.matrix);
          mesh.setColorAt(index, palette[box.tone % palette.length]);
          index++;
        }
      }
      mesh.count = index;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      if (styles) styles.needsUpdate = true;
      return index;
    };

    const surfaceCount = pack(surfaceMesh, surfacesByCell, SURFACE_TONES, styleAttribute);
    const lampCount = pack(lampMesh, lampsByCell, LAMP_TONES, null);
    latestVisibleCells = visible;

    latestDiagnostics = {
      worldId: descriptor.worldId,
      cellCount: graph.cells.length,
      visibleCellCount: visible.size,
      visibleCellIds: [...visible],
      occupiedCellId: occupied,
      instances: surfaceCount + lampCount,
      totalInstances: surfaceCapacity + lampCapacity,
      // Meshes submitted by the interior. Reading gl.info.render here reports the
      // composer's last post pass, not the scene, because the effect chain renders
      // at a higher frame priority and resets the counters before this runs — so a
      // real draw-call figure has to come from a GPU profile, not from here.
      meshes: 2,
      programs: gl.info.programs?.length ?? 0
    };
  });

  return (
    <>
      <instancedMesh
        ref={surfaceRef}
        args={[undefined, surfaceMaterial, surfaceCapacity]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]}>
          <primitive object={styleAttribute} attach="attributes-aStationStyle" />
        </boxGeometry>
      </instancedMesh>
      <instancedMesh
        ref={lampRef}
        args={[undefined, trimMaterial, lampCapacity]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </>
  );
}
