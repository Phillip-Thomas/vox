import * as THREE from "three"
import * as RAPIER from "@dimforge/rapier3d-compat"
import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useKeyboardControls } from "@react-three/drei"
// @ts-ignore - CapsuleCollider and useRapier exist at runtime but not in types
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier"

const SPEED = 5
const direction = new THREE.Vector3()
const frontVector = new THREE.Vector3()
const sideVector = new THREE.Vector3()

function Player() {
  const ref = useRef<any>(null)
  const rapier = useRapier()
  const [, get] = useKeyboardControls()
  
  useFrame((state) => {
    if (!ref.current) return
    
    const { forward, backward, left, right, jump } = get()
    const velocity = ref.current.linvel()
    
    // update camera
    const translation = ref.current.translation()

    state.camera.position.set(translation.x, translation.y, translation.z)
    
    frontVector.set(0, 0, Number(backward) - Number(forward))
    sideVector.set(Number(left) - Number(right), 0, 0)
    direction.subVectors(frontVector, sideVector).normalize().multiplyScalar(SPEED).applyEuler(state.camera.rotation)
    ref.current.setLinvel({ x: direction.x, y: velocity.y, z: direction.z })
    
    // jumping - fixed for proper rapier API
    const world = rapier.world.raw()
    const ray = world.castRay(
      new RAPIER.Ray(ref.current.translation(), { x: 0, y: -1, z: 0 }),
      10.0,  // maxToi - maximum distance
      true   // solid - whether to include solid bodies
    )
    const grounded = ray && ray.collider && Math.abs(ray.toi) <= 1.75
    if (jump && grounded) ref.current.setLinvel({ x: 0, y: 7.5, z: 0 })
  })
  
  return (
    <>
      <RigidBody ref={ref} colliders={false} mass={1} type="dynamic" position={[0, 20, 0]} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[0.75, 0.5]} />
      </RigidBody>
    </>
  )
}

export default Player; 
