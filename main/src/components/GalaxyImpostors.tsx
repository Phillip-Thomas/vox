import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  WorldCoordinate,
  coordinateToSeed,
  seededUnit
} from '../utils/worldCoordinates';
import {
  WorldPreviewTraits,
  deriveWorldPreviewTraits,
  previewSurfaceValue
} from '../utils/worldPreview';

interface GalaxyImpostorsProps {
  currentCoordinate: WorldCoordinate;
}

interface PlanetImpostor {
  coordinate: WorldCoordinate;
  seed: number;
  position: THREE.Vector3;
  radius: number;
  rotation: THREE.Euler;
  traits: WorldPreviewTraits;
  hasRings: boolean;
  ringColor: THREE.Color;
  ringRotation: THREE.Euler;
  ringScale: THREE.Vector3;
}

const GRID_RADIUS = 8;
const INNER_GRID_RADIUS = 2.85;
const MAX_VISIBLE_WORLDS = 32;
const BASE_DISTANCE = 2400;
const DISTANCE_PER_GRID = 280;
const DISTANCE_JITTER = 180;
const MIN_ELEVATION = 0.08;
const MAX_ELEVATION = 0.44;

const COLOR_SCRATCH = new THREE.Color();
const LIGHT_DIRECTION = new THREE.Vector3(-0.35, 0.78, 0.5).normalize();

function buildPlanetImpostors(currentCoordinate: WorldCoordinate): PlanetImpostor[] {
  const candidates: Array<{
    dx: number;
    dy: number;
    gridDistance: number;
    coordinate: WorldCoordinate;
    seed: number;
    priority: number;
    required: boolean;
  }> = [];

  for (let dx = -GRID_RADIUS; dx <= GRID_RADIUS; dx++) {
    for (let dy = -GRID_RADIUS; dy <= GRID_RADIUS; dy++) {
      if (dx === 0 && dy === 0) continue;
      const gridDistance = Math.hypot(dx, dy);
      if (gridDistance > GRID_RADIUS + 0.001) continue;

      const coordinate = {
        x: currentCoordinate.x + dx,
        y: currentCoordinate.y + dy
      };
      const seed = coordinateToSeed(coordinate.x, coordinate.y);
      candidates.push({
        dx,
        dy,
        gridDistance,
        coordinate,
        seed,
        priority: seededUnit(seed, 401),
        required: gridDistance <= INNER_GRID_RADIUS
      });
    }
  }

  const required = candidates.filter(candidate => candidate.required);
  const optional = candidates
    .filter(candidate => !candidate.required)
    .sort((a, b) => b.priority - a.priority || a.gridDistance - b.gridDistance)
    .slice(0, Math.max(0, MAX_VISIBLE_WORLDS - required.length));

  return [...required, ...optional]
    .sort((a, b) => a.gridDistance - b.gridDistance || a.seed - b.seed)
    .map(candidate => {
      const angleJitter = (seededUnit(candidate.seed, 11) - 0.5) * 0.16;
      const azimuth = Math.atan2(candidate.dy, candidate.dx) + angleJitter;
      const elevation = MIN_ELEVATION + seededUnit(candidate.seed, 17) * (MAX_ELEVATION - MIN_ELEVATION);
      const distance = BASE_DISTANCE +
        candidate.gridDistance * DISTANCE_PER_GRID +
        seededUnit(candidate.seed, 23) * DISTANCE_JITTER;
      const horizontal = Math.cos(elevation) * distance;
      const position = new THREE.Vector3(
        Math.cos(azimuth) * horizontal,
        Math.sin(elevation) * distance,
        Math.sin(azimuth) * horizontal
      );

      const nearFactor = THREE.MathUtils.clamp(1 - candidate.gridDistance / GRID_RADIUS, 0, 1);
      const radius = THREE.MathUtils.lerp(12, 42, nearFactor) + seededUnit(candidate.seed, 29) * 7;
      const ringTilt = 0.35 + seededUnit(candidate.seed, 53) * 0.85;
      const traits = deriveWorldPreviewTraits(candidate.seed);

      return {
        coordinate: candidate.coordinate,
        seed: candidate.seed,
        position,
        radius,
        rotation: new THREE.Euler(
          seededUnit(candidate.seed, 71) * Math.PI,
          seededUnit(candidate.seed, 73) * Math.PI * 2,
          seededUnit(candidate.seed, 79) * Math.PI
        ),
        traits,
        hasRings: seededUnit(candidate.seed, 61) > 0.9 && candidate.gridDistance > 1.5,
        ringColor: new THREE.Color().setHSL(0.09 + seededUnit(candidate.seed, 67) * 0.08, 0.28, 0.62),
        ringRotation: new THREE.Euler(
          Math.cos(azimuth) * ringTilt,
          azimuth,
          Math.sin(azimuth) * ringTilt
        ),
        ringScale: new THREE.Vector3(radius * 2.2, radius * 2.2, radius * 2.2)
      };
    });
}

function createPlanetSurfaceGeometry(planet: PlanetImpostor) {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const normal = new THREE.Vector3();
  const iceColor = new THREE.Color(0xd9e7ed);

  for (let i = 0; i < position.count; i++) {
    normal
      .set(position.getX(i), position.getY(i), position.getZ(i))
      .normalize();

    const surfaceValue = previewSurfaceValue(normal, planet.traits);
    const latitude = Math.abs(normal.y);
    const shade = 0.68 + Math.max(0, normal.dot(LIGHT_DIRECTION)) * 0.32;
    if (surfaceValue < planet.traits.oceanCoverage) {
      COLOR_SCRATCH.copy(planet.traits.oceanColor);
      COLOR_SCRATCH.offsetHSL(0, 0, (planet.traits.oceanCoverage - surfaceValue) * -0.12);
    } else if (latitude > planet.traits.iceCoverage) {
      COLOR_SCRATCH.copy(iceColor);
    } else if (surfaceValue > 0.78 - planet.traits.relief * 0.12) {
      COLOR_SCRATCH.copy(planet.traits.rockColor);
    } else {
      COLOR_SCRATCH.copy(planet.traits.landColor).lerp(
        planet.traits.rockColor,
        Math.max(0, surfaceValue - 0.58) * (0.9 + planet.traits.relief)
      );
    }
    COLOR_SCRATCH.multiplyScalar(shade);
    colors[i * 3] = COLOR_SCRATCH.r;
    colors[i * 3 + 1] = COLOR_SCRATCH.g;
    colors[i * 3 + 2] = COLOR_SCRATCH.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function DistantPlanet({
  planet,
  surfaceMaterial,
  cloudGeometry,
  atmosphereGeometry,
  ringGeometry
}: {
  planet: PlanetImpostor;
  surfaceMaterial: THREE.Material;
  cloudGeometry: THREE.BufferGeometry;
  atmosphereGeometry: THREE.BufferGeometry;
  ringGeometry: THREE.BufferGeometry;
}) {
  const surfaceGeometry = useMemo(() => createPlanetSurfaceGeometry(planet), [planet]);

  useEffect(() => {
    return () => surfaceGeometry.dispose();
  }, [surfaceGeometry]);

  return (
    <group
      position={[planet.position.x, planet.position.y, planet.position.z]}
      rotation={planet.rotation}
      scale={planet.radius}
    >
      <mesh geometry={surfaceGeometry} material={surfaceMaterial} frustumCulled={false} />
      <mesh geometry={cloudGeometry} scale={1.022} frustumCulled={false}>
        <meshBasicMaterial
          color={planet.traits.cloudColor}
          transparent
          opacity={0.055}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={atmosphereGeometry} scale={1.08} frustumCulled={false}>
        <meshBasicMaterial
          color={planet.traits.atmosphereColor}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
          fog={false}
          toneMapped={false}
        />
      </mesh>

      {planet.hasRings && (
        <mesh
          geometry={ringGeometry}
          position={[0, 0, 0]}
          rotation={planet.ringRotation}
          scale={planet.ringScale.clone().multiplyScalar(1 / planet.radius)}
          frustumCulled={false}
        >
          <meshBasicMaterial
            color={planet.ringColor}
            transparent
            opacity={0.34}
            side={THREE.DoubleSide}
            depthWrite={false}
            fog={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  );
}

export default function GalaxyImpostors({ currentCoordinate }: GalaxyImpostorsProps) {
  const groupRef = useRef<THREE.Group>(null);

  const planets = useMemo(
    () => buildPlanetImpostors(currentCoordinate),
    [currentCoordinate.x, currentCoordinate.y]
  );

  const cloudGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 2), []);
  const atmosphereGeometry = useMemo(() => new THREE.SphereGeometry(1, 24, 12), []);
  const ringGeometry = useMemo(() => new THREE.RingGeometry(0.74, 1.05, 72), []);
  const surfaceMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: false,
    toneMapped: false
  }), []);

  useFrame(({ camera }) => {
    groupRef.current?.position.copy(camera.position);
  });

  useEffect(() => {
    return () => {
      cloudGeometry.dispose();
      atmosphereGeometry.dispose();
      ringGeometry.dispose();
      surfaceMaterial.dispose();
    };
  }, [
    cloudGeometry,
    atmosphereGeometry,
    ringGeometry,
    surfaceMaterial
  ]);

  return (
    <group ref={groupRef}>
      {planets.map(planet => (
        <DistantPlanet
          key={`${planet.coordinate.x},${planet.coordinate.y}`}
          planet={planet}
          surfaceMaterial={surfaceMaterial}
          cloudGeometry={cloudGeometry}
          atmosphereGeometry={atmosphereGeometry}
          ringGeometry={ringGeometry}
        />
      ))}
    </group>
  );
}
