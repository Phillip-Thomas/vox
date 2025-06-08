import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useRef, useState, useMemo } from 'react'
import { Text } from '@react-three/drei'

/* ------------------------------------------------------------------ */
/* 1. Cube-map constants                                              */
/* ------------------------------------------------------------------ */
type Face = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z'

const FACES: Face[] = ['+Y', '-Y', '+X', '-X', '+Z', '-Z']
const N = 10           // face is N × N metres
const HALF = N / 2
const SPEED = 5        // units per second

// Define rotation axes
const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)
const FWD = new THREE.Vector3(0, 0, 1)

/* Edge mapping (12 entries)  --------------------------------------- */
/* newU/V expect coords that may be <0 or >=N and wrap them properly. */
type EdgeRule = { newFace: Face; rot: THREE.Quaternion; newUV: (u: number, v: number) => [number, number] }
type EdgeMap = Record<Face, {LEFT: EdgeRule; RIGHT: EdgeRule; TOP: EdgeRule; BOTTOM: EdgeRule}>

const Q = (axis: THREE.Vector3, deg: number) =>
  new THREE.Quaternion().setFromAxisAngle(axis, THREE.MathUtils.degToRad(deg))


const EDGE: EdgeMap = {
  '+X': {
    LEFT   : { newFace:'+Z', newUV:(u,v)=>[ N-1 , v ], rot: Q(UP , -90) }, // ← was +90
    RIGHT  : { newFace:'-Z', newUV:(u,v)=>[ 0   , v ], rot: Q(UP , +90) }, // ← was -90
    TOP    : { newFace:'+Y', newUV:(u,v)=>[N-1 , u     ], rot: Q(FWD,+90) },
    BOTTOM : { newFace:'-Y', newUV:(u,v)=>[N-1 , N-1-u ], rot: Q(FWD,-90) },
  },
  '-X': {
    LEFT   : { newFace:'-Z', newUV:(u,v)=>[ N-1 , v ], rot: Q(UP , -90) }, // ← was +90
    RIGHT  : { newFace:'+Z', newUV:(u,v)=>[ 0   , v ], rot: Q(UP , +90) }, // ← was -90
    TOP    : { newFace:'+Y', newUV:(u,v)=>[0   , N-1-u ], rot: Q(FWD,-90) },
    BOTTOM : { newFace:'-Y', newUV:(u,v)=>[0   , u     ], rot: Q(FWD,+90) },
  },
  '+Z': {
    LEFT  : { newFace:'-X', newUV:(u,v)=>[ N-1 , v ], rot: Q(UP , -90) }, // ← was +90
    RIGHT : { newFace:'+X', newUV:(u,v)=>[ 0   , v ], rot: Q(UP , +90) }, // ← was -90
    TOP    : { newFace: '+Y', newUV: (u,v)=>[ N-1-u    , N-1       ], rot: Q(FWD ,   0) },
    BOTTOM : { newFace: '-Y', newUV: (u,v)=>[ N-1-u    , 0         ], rot: Q(FWD , 180) },
  },
  '-Z': {
    LEFT  : { newFace:'+X', newUV:(u,v)=>[ N-1 , v ], rot: Q(UP , -90) }, // ← was +90
    RIGHT : { newFace:'-X', newUV:(u,v)=>[ 0   , v ], rot: Q(UP , +90) }, // ← was -90
    TOP    : { newFace: '+Y', newUV: (u,v)=>[ u        , N-1       ], rot: Q(FWD ,   0) },
    BOTTOM : { newFace: '-Y', newUV: (u,v)=>[ u        , 0         ], rot: Q(FWD , 180) },
  },
  '+Y': {
  LEFT   : { newFace: '-X', newUV: (u,v)=>[ N-1-v , N-1 ], rot: Q(FWD ,+90) },
  RIGHT  : { newFace: '+X', newUV: (u,v)=>[ v     , N-1 ], rot: Q(FWD ,-90) },
  TOP    : { newFace: '+Z', newUV: (u,v)=>[ v     , N-1 ], rot: Q(FWD ,  0) },
  BOTTOM : { newFace: '-Z', newUV: (u,v)=>[ N-1-v , N-1 ], rot: Q(FWD ,180) },
},
'-Y': {
  LEFT   : { newFace: '-X', newUV: (u,v)=>[ v     , 0   ], rot: Q(FWD ,-90) },
  RIGHT  : { newFace: '+X', newUV: (u,v)=>[ N-1-v , 0   ], rot: Q(FWD ,+90) },
  TOP    : { newFace: '-Z', newUV: (u,v)=>[ N-1-v , 0   ], rot: Q(FWD ,  0) },
  BOTTOM : { newFace: '+Z', newUV: (u,v)=>[ v     , 0   ], rot: Q(FWD ,180) },
},
};
/* ------------------------------------------------------------------ */
/* 2. Player controller                                               */
/* ------------------------------------------------------------------ */
function Player() {
  const mesh = useRef<THREE.Mesh>(null!)
  const points = useRef<THREE.Vector3[]>([])
  const maxPoints = 100

  // Initialize points array if empty
  if (points.current.length === 0) {
    const startPos = faceLocalToWorld('+X', N-1, N/2)  // Start at right edge
    points.current.push(startPos)
  }

  // face, local coords, heading (dir in face-space)
  const [state] = useState(() => ({
    face: '+X' as Face,
    u: N / 2,    // Middle width
    v: N/2,        // Start at bottom edge
    dir: new THREE.Vector2(0, 1), // Moving up
    quat: new THREE.Quaternion(),
    startTime: Date.now()
  }))

  useFrame((_, dt) => {
    // Move forward continuously
    const newU = state.u + state.dir.x * dt * SPEED
    const newV = state.v + state.dir.y * dt * SPEED

    // Check if we need to transition to a new face
    if (newU < 0 || newU >= N || newV < 0 || newV >= N) {
      const edge =
        newU < 0 ? 'LEFT' :
        newU >= N ? 'RIGHT' :
        newV >= N ? 'TOP' : 'BOTTOM' as const
      const rule = EDGE[state.face][edge]
      
      // Apply transition
      const prevFace = state.face; 
      const [nextU, nextV] = rule.newUV(newU, newV)
      state.u = nextU
      state.v = nextV
      state.face = rule.newFace

      const BASIS: Record<Face, { u: THREE.Vector3; v: THREE.Vector3 }> = {
        '+X': { u: new THREE.Vector3( 0, 0,-1), v: new THREE.Vector3( 0, 1, 0) },
        '-X': { u: new THREE.Vector3( 0, 0, 1), v: new THREE.Vector3( 0, 1, 0) },
        '+Z': { u: new THREE.Vector3( 1, 0, 0), v: new THREE.Vector3( 0, 1, 0) },
        '-Z': { u: new THREE.Vector3(-1, 0, 0), v: new THREE.Vector3( 0, 1, 0) },
      
        /* ‼ the two lines below are the only change */
        '+Y': { u: new THREE.Vector3( 1, 0, 0), v: new THREE.Vector3( 0, 0, 1) }, //  u=+X , v=+Z
        '-Y': { u: new THREE.Vector3( 1, 0, 0), v: new THREE.Vector3( 0, 0,-1) }, //  u=+X , v=-Z
      };
      function localDirToWorld(face: Face, d: THREE.Vector2) {
        const { u, v } = BASIS[face];
        return u.clone().multiplyScalar(d.x).add(v.clone().multiplyScalar(d.y)).normalize();
      }
      
      function worldDirToLocal(face: Face, w: THREE.Vector3) {
        const { u, v } = BASIS[face];
        return new THREE.Vector2(w.dot(u), w.dot(v)).normalize();
      }

      // Convert direction to 3D, rotate it, then back to 2D
      const dir3D = localDirToWorld(prevFace, state.dir)
      dir3D.applyQuaternion(rule.rot)
      state.dir.copy(worldDirToLocal(state.face, dir3D))
      state.quat.multiply(rule.rot)

      // Ensure direction is normalized
      const len = Math.sqrt(state.dir.x * state.dir.x + state.dir.y * state.dir.y)
      if (len > 0) {
        state.dir.x /= len
        state.dir.y /= len
      }

      console.log(`Transitioning to face ${state.face}, u=${state.u.toFixed(2)}, v=${state.v.toFixed(2)}, dir=(${state.dir.x.toFixed(2)},${state.dir.y.toFixed(2)})`)
    } else {
      state.u = newU
      state.v = newV
    }

    // Update position and orientation
    const pos = faceLocalToWorld(state.face, state.u, state.v)
    mesh.current.position.copy(pos)
    mesh.current.quaternion.copy(state.quat)

    // Update trail
    points.current.push(pos.clone())
    if (points.current.length > maxPoints) {
      points.current.shift()
    }

    // Log every second
    if (Date.now() - state.startTime > 1000) {
      console.log(`Face: ${state.face}, u=${state.u.toFixed(2)}, v=${state.v.toFixed(2)}, dir=(${state.dir.x.toFixed(2)},${state.dir.y.toFixed(2)})`)
      state.startTime = Date.now()
    }
  })

  return (
    <>
      <mesh ref={mesh}>
        <coneGeometry args={[0.2, 0.4, 4]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      <Trail points={points.current} />
    </>
  )
}

function Trail({ points }: { points: THREE.Vector3[] }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    if (points.length > 1) {
      geo.setFromPoints(points)
    }
    return geo
  }, [points])

  return (
    <line>
      <primitive object={geometry} />
      <lineBasicMaterial color="yellow" linewidth={2} />
    </line>
  )
}

/* helper: local grid coord to cube world position */
function faceLocalToWorld(face: Face, u: number, v: number) {
  const t = u - HALF
  const s = v - HALF
  switch (face) {
    case '+X': return new THREE.Vector3(+HALF, s, -t)
    case '-X': return new THREE.Vector3(-HALF, s,  t)
    case '+Y': return new THREE.Vector3( t, +HALF, -s)
    case '-Y': return new THREE.Vector3( t, -HALF,  s)
    case '+Z': return new THREE.Vector3( t, s, +HALF)
    case '-Z': return new THREE.Vector3(-t, s, -HALF)
  }
}

/* ------------------------------------------------------------------ */
/* 3. Six plane meshes (one per face)                                 */
/* ------------------------------------------------------------------ */
function FacePlane({ face }: { face: Face }) {
  const geo = new THREE.PlaneGeometry(N, N, 10, 10)
  const mat = new THREE.MeshStandardMaterial({ 
    color: '#4caf50', 
    wireframe: true,
    side: THREE.DoubleSide 
  })
  const mesh = new THREE.Mesh(geo, mat)

  switch (face) {
    case '+X': mesh.rotation.y = -Math.PI / 2; mesh.position.x = +HALF; break
    case '-X': mesh.rotation.y =  Math.PI / 2; mesh.position.x = -HALF; break
    case '+Y': mesh.rotation.x = -Math.PI / 2; mesh.position.y = +HALF; break
    case '-Y': mesh.rotation.x =  Math.PI / 2; mesh.position.y = -HALF; break
    case '+Z':                               mesh.position.z = +HALF; break
    case '-Z': mesh.rotation.y =  Math.PI;    mesh.position.z = -HALF; break
  }
  return <primitive object={mesh} />
}

function FaceLabel({ face, position }: { face: string, position: [number, number, number] }) {
  return (
    <Text
      position={position}
      fontSize={2}
      color="white"
      anchorX="center"
      anchorY="middle"
    >
      {face}
    </Text>
  )
}

/* ------------------------------------------------------------------ */
/* 4. Scene root                                                      */
/* ------------------------------------------------------------------ */
export default function App() {
  return (
    <Canvas shadows camera={{ position: [20, 15, 20], fov: 50 }}>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={1} castShadow />
      {/* six faces */}
      {FACES.map(f => <FacePlane key={f} face={f} />)}
      {/* player */}
      <Player />
      <OrbitControls enablePan={false} makeDefault />
      {/* Face Labels */}
      <FaceLabel face="X+" position={[5, 0, 0]} />
      <FaceLabel face="X-" position={[-5, 0, 0]} />
      <FaceLabel face="Y+" position={[0, 5, 0]} />
      <FaceLabel face="Y-" position={[0, -5, 0]} />
      <FaceLabel face="Z-" position={[0, 0, -5]} />
      <FaceLabel face="Z+" position={[0, 0, 5]} />
    </Canvas>
  )
} 