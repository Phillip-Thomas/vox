import * as THREE from "three"
import * as RAPIER from "@dimforge/rapier3d-compat"
import { useRef } from "react"
import { useFrame } from "@react-three/fiber"
import { useKeyboardControls } from "@react-three/drei"
// @ts-ignore - CapsuleCollider and useRapier exist at runtime but not in types
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier"
import { planetInstancedMesh, planetInstanceMaterials, planetRigidBodies } from './Planet'

const SPEED = 5
const direction = new THREE.Vector3()
const frontVector = new THREE.Vector3()
const sideVector = new THREE.Vector3()

// Three.js visual raycast hook
function useVisualRaycast() {
  const raycaster = new THREE.Raycaster()
  
  return (camera: THREE.Camera, instancedMesh: THREE.InstancedMesh | null) => {
    if (!instancedMesh) return null
    
    // Cast ray from camera center (screen center)
    const ndc = new THREE.Vector2(0, 0) // Screen center
    raycaster.setFromCamera(ndc, camera)
    
    const hits = raycaster.intersectObject(instancedMesh)
    if (hits[0] && hits[0].instanceId !== undefined) {
      return {
        instanceIndex: hits[0].instanceId,
        point: hits[0].point,
        distance: hits[0].distance,
        face: hits[0].face,
        normal: hits[0].face?.normal
      }
    }
    
    return null
  }
}

function Player() {
  const ref = useRef<any>(null)
  const rapier = useRapier()
  const [, get] = useKeyboardControls()
  const visualRaycast = useVisualRaycast()
  
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
    
    if (jump) ref.current.setLinvel({ x: 0, y: 7.5, z: 0 })

    // Terrain manipulator - visual raycast from camera center
    const hitInfo = visualRaycast(state.camera, planetInstancedMesh.current)
    if (hitInfo) {
      const material = planetInstanceMaterials.current[hitInfo.instanceIndex]
      const rigidBody = planetRigidBodies.current[hitInfo.instanceIndex]
      
      console.log("✅ Hit voxel:", {
        instanceIndex: hitInfo.instanceIndex,
        material: material,
        distance: hitInfo.distance,
        position: rigidBody?.translation(),
        userData: rigidBody?.userData,
        point: hitInfo.point,
        normal: hitInfo.normal,
      });
      
    }
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
