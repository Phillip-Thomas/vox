import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { theme } from '../../ui/theme.ts';
import { isTouchDevice } from '../../utils/mobileInput.ts';
import { getPlayerWorldPosition, getPlayerLook, getPlayerUp } from '../../state/playerFrame.ts';
import { useSpaceFlight } from '../../state/spaceFlight.ts';
import { getShipPosition, subscribeShipProximity } from '../../state/shipProximity.ts';
import { getLocalActorId, subscribeLocalActorId } from '../../game/playerActors.ts';
import { getPlayerPoses, subscribePlayerPoses } from '../../game/systems/playerPoseSystem.ts';
import { getCampfires, subscribeCampfires } from '../../game/systems/campfires.ts';
import { getPieces, subscribeStructures } from '../../game/systems/structureSystem.ts';
import {
  buildOrbitalMinimapModel,
  type LocalOrbitalMarker,
  type OrbitalMarker,
  type OrbitalMinimapModel,
  type Vec3Tuple
} from './orbitalMinimapModel.ts';

interface OrbitalMinimapProps {
  coordinateLabel: string;
  worldId: string;
  planetSize: number;
}

interface LocalFrame {
  position: Vec3Tuple;
  forward: Vec3Tuple;
  up: Vec3Tuple;
  pitch: number;
}

const READ_INTERVAL_MS = 90;
const FRAME_HALF_SIZE = 0.86;
const FACE_GUIDE_HALF_SIZE = FRAME_HALF_SIZE * 0.78;
const DISPLAY_FACE_YAW = THREE.MathUtils.degToRad(30);
const DISPLAY_FACE_PITCH = THREE.MathUtils.degToRad(-15);
const MINIMAP_CAMERA_POSITION = new THREE.Vector3(2.6, 2.1, 3.4);

const OrbitalMinimap: React.FC<OrbitalMinimapProps> = ({ coordinateLabel, worldId, planetSize }) => {
  const flight = useSpaceFlight();
  const touch = isTouchDevice();
  const [localFrame, setLocalFrame] = useState<LocalFrame>(() => readLocalFrame());
  const [localActorId, setLocalActorId] = useState(() => getLocalActorId());
  const [poses, setPoses] = useState(() => getPlayerPoses());
  const [campfires, setCampfires] = useState(() => [...getCampfires()]);
  const [structures, setStructures] = useState(() => getPieces());
  const [parkedShip, setParkedShip] = useState(() => getShipPosition());

  useEffect(() => {
    const id = window.setInterval(() => {
      setLocalFrame(prev => {
        const next = readLocalFrame();
        return sameFrame(prev, next) ? prev : next;
      });
    }, READ_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => subscribeLocalActorId(() => setLocalActorId(getLocalActorId())), []);
  useEffect(() => subscribePlayerPoses(() => setPoses(getPlayerPoses())), []);
  useEffect(() => subscribeCampfires(() => setCampfires([...getCampfires()])), []);
  useEffect(() => subscribeStructures(() => setStructures(getPieces())), []);
  useEffect(() => subscribeShipProximity(() => setParkedShip(getShipPosition())), []);

  const model = useMemo(() => buildOrbitalMinimapModel({
    planetSize,
    worldId,
    localActorId,
    localPosition: localFrame.position,
    localForward: localFrame.forward,
    localUp: localFrame.up,
    localPitch: localFrame.pitch,
    remotePlayers: poses,
    campfires,
    structures,
    shipPosition: flight.controlMode === 'fps' ? parkedShip : null
  }), [campfires, flight.controlMode, localActorId, localFrame, parkedShip, planetSize, poses, structures, worldId]);

  const panelWidth = touch ? 144 : 190;
  const canvasSize = touch ? 108 : 140;
  const phaseLabel = flight.phase === 'deep_space' ? 'SPACE' : `${model.local.face.toUpperCase()} FACE`;
  const totalPlayers = model.counts.remotePlayers + 1;

  return (
    <section
      aria-label="Orbital minimap"
      data-testid="orbital-minimap"
      data-minimap-ready="true"
      style={{
        position: 'absolute',
        top: touch ? 'calc(72px + env(safe-area-inset-top, 0px))' : 72,
        right: touch ? 'calc(12px + env(safe-area-inset-right, 0px))' : 14,
        width: panelWidth,
        boxSizing: 'border-box',
        zIndex: theme.z.hud - 1,
        pointerEvents: 'none',
        color: theme.color.text,
        fontFamily: theme.font.mono,
        background: 'linear-gradient(180deg, rgba(5,8,15,0.72), rgba(7,12,23,0.52))',
        border: '1px solid rgba(125,211,252,0.25)',
        borderRadius: 8,
        boxShadow: '0 12px 34px rgba(0,0,0,0.42), inset 0 0 24px rgba(56,189,248,0.07)',
        backdropFilter: theme.glass.blur,
        WebkitBackdropFilter: theme.glass.blur,
        overflow: 'hidden'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        padding: touch ? '7px 8px 5px' : '8px 10px 6px',
        fontSize: touch ? 8 : 9,
        letterSpacing: '0.11em',
        textTransform: 'uppercase',
        color: theme.color.accent
      }}>
        <span>Orbital Scan</span>
        <span style={{ color: theme.color.textDim }}>{phaseLabel}</span>
      </div>

      <div style={{
        position: 'relative',
        width: canvasSize,
        height: canvasSize,
        margin: '0 auto',
        borderRadius: 8,
        background: 'radial-gradient(circle at 50% 48%, rgba(56,189,248,0.13), rgba(5,8,15,0.08) 58%, rgba(5,8,15,0) 72%)'
      }}>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: true }}
          camera={{ position: [2.6, 2.1, 3.4], fov: 36, near: 0.1, far: 20 }}
          style={{ position: 'absolute', inset: 0 }}
        >
          <OrbitalMinimapScene model={model} />
        </Canvas>
        <div style={{
          position: 'absolute',
          inset: 9,
          border: '1px solid rgba(125,211,252,0.16)',
          borderRadius: '50%',
          boxShadow: 'inset 0 0 18px rgba(125,211,252,0.10)'
        }} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        alignItems: 'center',
        padding: touch ? '6px 8px 8px' : '7px 10px 9px',
        fontSize: touch ? 8 : 9,
        lineHeight: 1.35,
        color: theme.color.textDim
      }}>
        <span style={{
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>{coordinateLabel}</span>
        <span style={{ color: theme.color.accent, whiteSpace: 'nowrap' }}>
          P {totalPlayers} | B {model.counts.structures} | F {model.counts.campfires}
        </span>
      </div>
    </section>
  );
};

const OrbitalMinimapScene: React.FC<{ model: OrbitalMinimapModel }> = ({ model }) => {
  const rig = useRef<THREE.Group>(null);
  const sweep = useRef<THREE.Mesh>(null);
  const targetMapQuaternion = useMemo(() => mapQuaternionForFace(model.local), [model.local.face]);

  useFrame((_, dt) => {
    if (rig.current) {
      const blend = 1 - Math.exp(-dt * 7.5);
      rig.current.quaternion.slerp(targetMapQuaternion, blend);
    }
    if (sweep.current) sweep.current.rotation.y += dt * 1.28;
  });

  return (
    <>
      <CameraLookAt />
      <ambientLight intensity={1.15} />
      <pointLight position={[2.8, 3, 3.2]} intensity={9} color="#7dd3fc" />
      <pointLight position={[-2.2, -1.8, 2.4]} intensity={3} color="#f59e0b" />
      <group ref={rig}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[FRAME_HALF_SIZE * 1.28, 0.006, 8, 112]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.34} />
        </mesh>
        <mesh ref={sweep}>
          <boxGeometry args={[FRAME_HALF_SIZE * 1.52, 0.008, 0.008]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.38} depthWrite={false} />
        </mesh>
        <ShardFrame local={model.local} />
        {model.markers.map(marker => <OrbitalMarkerMesh key={marker.id} marker={marker} />)}
        <LocalMarkerMesh local={model.local} />
      </group>
    </>
  );
};

const CameraLookAt: React.FC = () => {
  const { camera } = useThree();
  useEffect(() => {
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
};

const ShardFrame: React.FC<{ local: LocalOrbitalMarker }> = ({ local }) => {
  const frame = useMemo(() => {
    const normal = vectorFromTuple(local.faceNormal);
    const u = vectorFromTuple(local.uAxis);
    const v = vectorFromTuple(local.vAxis);
    const center = normal.clone().multiplyScalar(FRAME_HALF_SIZE + 0.012);
    const rearCenter = normal.clone().multiplyScalar(-FRAME_HALF_SIZE);
    const planeQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const edgeOpacity = 0.72;
    const hiddenOpacity = 0.26;
    const current = cubeFaceCorners(center, u, v);
    const rear = cubeFaceCorners(rearCenter, u, v);

    return {
      center,
      u,
      v,
      planeQuaternion,
      guideHalfSize: FACE_GUIDE_HALF_SIZE,
      edgeOpacity,
      hiddenOpacity,
      current,
      rear,
      visibleEdges: edgesForCorners(current),
      hiddenEdges: [
        ...edgesForCorners(rear),
        ...current.map((corner, index) => [corner, rear[index]] as const)
      ]
    };
  }, [local.faceNormal, local.uAxis, local.vAxis]);

  return (
    <group>
      <mesh position={frame.center} quaternion={frame.planeQuaternion}>
        <planeGeometry args={[FRAME_HALF_SIZE * 2.02, FRAME_HALF_SIZE * 2.02]} />
        <meshBasicMaterial
          color="#7dd3fc"
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {frame.visibleEdges.map(([start, end], index) => (
        <AxisBar
          key={`visible-${index}`}
          start={start}
          end={end}
          color="#7dd3fc"
          opacity={frame.edgeOpacity}
          thickness={0.014}
        />
      ))}
      {frame.hiddenEdges.map(([start, end], index) => (
        <DashedAxisBar
          key={`hidden-${index}`}
          start={start}
          end={end}
          color="#7dd3fc"
          opacity={frame.hiddenOpacity}
          thickness={0.008}
        />
      ))}
      <AxisBar
        start={frame.center.clone().addScaledVector(frame.u, -frame.guideHalfSize)}
        end={frame.center.clone().addScaledVector(frame.u, frame.guideHalfSize)}
        color="#38bdf8"
        opacity={0.78}
        thickness={0.016}
      />
      <AxisBar
        start={frame.center.clone().addScaledVector(frame.v, -frame.guideHalfSize)}
        end={frame.center.clone().addScaledVector(frame.v, frame.guideHalfSize)}
        color="#86efac"
        opacity={0.68}
        thickness={0.016}
      />
    </group>
  );
};

const AxisBar: React.FC<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
  thickness: number;
}> = ({ start, end, color, opacity, thickness }) => {
  const transform = useMemo(() => {
    const delta = end.clone().sub(start);
    const length = Math.max(delta.length(), 0.0001);
    const direction = delta.normalize();
    return {
      midpoint: start.clone().add(end).multiplyScalar(0.5),
      length,
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction)
    };
  }, [end, start]);

  return (
    <mesh position={transform.midpoint} quaternion={transform.quaternion}>
      <boxGeometry args={[transform.length, thickness, thickness]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
};

const DashedAxisBar: React.FC<{
  start: THREE.Vector3;
  end: THREE.Vector3;
  color: string;
  opacity: number;
  thickness: number;
}> = ({ start, end, color, opacity, thickness }) => {
  const segments = useMemo(() => {
    const delta = end.clone().sub(start);
    const length = delta.length();
    if (length <= 0.0001) return [];
    const direction = delta.normalize();
    const dash = 0.105;
    const gap = 0.072;
    const step = dash + gap;
    const count = Math.max(1, Math.floor(length / step));
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
    const result: { midpoint: THREE.Vector3; length: number; quaternion: THREE.Quaternion }[] = [];

    for (let i = 0; i < count; i++) {
      const segmentStart = i * step;
      const segmentEnd = Math.min(segmentStart + dash, length);
      if (segmentEnd <= segmentStart) continue;
      const midpointDistance = (segmentStart + segmentEnd) * 0.5;
      result.push({
        midpoint: start.clone().addScaledVector(direction, midpointDistance),
        length: segmentEnd - segmentStart,
        quaternion: quaternion.clone()
      });
    }

    return result;
  }, [end, start]);

  return (
    <group>
      {segments.map((segment, index) => (
        <mesh key={index} position={segment.midpoint} quaternion={segment.quaternion}>
          <boxGeometry args={[segment.length, thickness, thickness]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

const OrbitalMarkerMesh: React.FC<{ marker: OrbitalMarker }> = ({ marker }) => {
  const position = marker.minimapPosition;
  const opacity = marker.stale ? 0.38 : 1;

  if (marker.kind === 'structure') {
    return (
      <mesh position={position}>
        <boxGeometry args={[0.045, 0.045, 0.045]} />
        <meshStandardMaterial color="#cbd5e1" emissive="#7dd3fc" emissiveIntensity={0.2} transparent opacity={0.72} />
      </mesh>
    );
  }

  if (marker.kind === 'campfire') {
    return (
      <mesh position={position}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f97316" emissiveIntensity={1.1} transparent opacity={0.92} />
      </mesh>
    );
  }

  if (marker.kind === 'ship') {
    return (
      <mesh position={position}>
        <octahedronGeometry args={[0.085, 0]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.76} roughness={0.35} />
      </mesh>
    );
  }

  return (
    <mesh position={position}>
      <sphereGeometry args={[0.073, 14, 10]} />
      <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.75} transparent opacity={opacity} />
    </mesh>
  );
};

const LocalMarkerMesh: React.FC<{ local: LocalOrbitalMarker }> = ({ local }) => {
  const quaternion = useMemo(() => {
    const direction = new THREE.Vector3(local.heading[0], local.heading[1], local.heading[2]);
    if (direction.lengthSq() < 1e-7) direction.set(0, 0, -1);
    direction.normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  }, [local.heading]);

  return (
    <group position={local.minimapPosition}>
      <mesh quaternion={quaternion}>
        <coneGeometry args={[0.07, 0.24, 18]} />
        <meshStandardMaterial color="#86efac" emissive="#22c55e" emissiveIntensity={0.82} roughness={0.32} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.047, 12, 8]} />
        <meshStandardMaterial color="#ecfeff" emissive="#7dd3fc" emissiveIntensity={0.62} />
      </mesh>
    </group>
  );
};

function readLocalFrame(): LocalFrame {
  const pos = getPlayerWorldPosition();
  const look = getPlayerLook();
  const up = getPlayerUp();
  return {
    position: [pos.x, pos.y, pos.z],
    forward: [look.forward.x, look.forward.y, look.forward.z],
    up: [up.x, up.y, up.z],
    pitch: look.pitch
  };
}

function sameFrame(a: LocalFrame, b: LocalFrame): boolean {
  return sameVec3(a.position, b.position, 0.04)
    && sameVec3(a.forward, b.forward, 0.01)
    && sameVec3(a.up, b.up, 0.01)
    && Math.abs(a.pitch - b.pitch) <= 0.01;
}

function sameVec3(a: Vec3Tuple, b: Vec3Tuple, epsilon: number): boolean {
  return Math.abs(a[0] - b[0]) <= epsilon
    && Math.abs(a[1] - b[1]) <= epsilon
    && Math.abs(a[2] - b[2]) <= epsilon;
}

function vectorFromTuple(tuple: Vec3Tuple): THREE.Vector3 {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]).normalize();
}

function cubeFaceCorners(center: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3): THREE.Vector3[] {
  return [
    center.clone().addScaledVector(v, -FRAME_HALF_SIZE).addScaledVector(u, -FRAME_HALF_SIZE),
    center.clone().addScaledVector(v, -FRAME_HALF_SIZE).addScaledVector(u, FRAME_HALF_SIZE),
    center.clone().addScaledVector(v, FRAME_HALF_SIZE).addScaledVector(u, FRAME_HALF_SIZE),
    center.clone().addScaledVector(v, FRAME_HALF_SIZE).addScaledVector(u, -FRAME_HALF_SIZE)
  ];
}

function edgesForCorners(corners: readonly THREE.Vector3[]): [THREE.Vector3, THREE.Vector3][] {
  return [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]]
  ];
}

function mapQuaternionForFace(local: LocalOrbitalMarker): THREE.Quaternion {
  const sourceU = vectorFromTuple(local.uAxis);
  const sourceV = vectorFromTuple(local.vAxis);
  const sourceNormal = vectorFromTuple(local.faceNormal);

  const squareOnNormal = MINIMAP_CAMERA_POSITION.clone().normalize();
  const squareOnUp = new THREE.Vector3(0, 1, 0)
    .addScaledVector(squareOnNormal, -new THREE.Vector3(0, 1, 0).dot(squareOnNormal))
    .normalize();
  const squareOnRight = new THREE.Vector3().crossVectors(squareOnUp, squareOnNormal).normalize();
  const displayNormal = squareOnNormal
    .clone()
    .applyAxisAngle(squareOnUp, DISPLAY_FACE_YAW)
    .applyAxisAngle(squareOnRight, DISPLAY_FACE_PITCH)
    .normalize();
  const displayV = squareOnUp.clone()
    .addScaledVector(displayNormal, -squareOnUp.dot(displayNormal))
    .normalize();
  const displayU = new THREE.Vector3().crossVectors(displayV, displayNormal).normalize();

  const sourceBasis = new THREE.Matrix4().makeBasis(sourceU, sourceV, sourceNormal);
  const displayBasis = new THREE.Matrix4().makeBasis(displayU, displayV, displayNormal);
  const sourceInverse = sourceBasis.clone().invert();
  return new THREE.Quaternion().setFromRotationMatrix(displayBasis.multiply(sourceInverse));
}

export default OrbitalMinimap;
