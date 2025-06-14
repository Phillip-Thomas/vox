import * as THREE from "three"
import { useRef, useEffect } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { useKeyboardControls, PerspectiveCamera } from "@react-three/drei"
// @ts-ignore - CapsuleCollider exists at runtime but not in types
import { CapsuleCollider, RigidBody, useRapier } from "@react-three/rapier"
import { planetInstancedMesh, planetInstanceMaterials, planetRigidBodies } from './Planet'
import { useGravityContext } from '../App';
import { usePlayer } from '../context/PlayerContext';

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

export default function Player() {
  const ref = useRef<any>(null)
  const [, get] = useKeyboardControls()
  const visualRaycast = useVisualRaycast()
  const { controls } = useThree()
  const { checkBoundaries, isChanging, changeGravity } = useGravityContext();
  const { currentFace, faceOrientation, setCurrentFace } = usePlayer();
  const cameraRef = useRef<THREE.PerspectiveCamera>(null)
  
  // Mouse look state
  const mouseRef = useRef({ x: 0, y: 0 })
  const isLockedRef = useRef(false)
  
  // Pointer lock controls
  useEffect(() => {
    const handleClick = () => {
      document.body.requestPointerLock()
    }
    
    const handlePointerLockChange = () => {
      isLockedRef.current = document.pointerLockElement === document.body
    }
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!isLockedRef.current || !cameraRef.current) return
      
      const sensitivity = 0.002
      mouseRef.current.x -= event.movementX * sensitivity
      mouseRef.current.y -= event.movementY * sensitivity
      
      // Clamp vertical rotation
      mouseRef.current.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseRef.current.y))
    }
    
    document.addEventListener('click', handleClick)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])
  
  useFrame((state, deltaTime) => {
    if (!ref.current) return
    
    // Update camera rotation based on mouse input
    if (cameraRef.current && isLockedRef.current) {
      cameraRef.current.rotation.set(mouseRef.current.y, mouseRef.current.x, 0)
    }
    
    const { forward, backward, left, right, jump } = get()
    const velocity = ref.current.linvel()
    
    // Get player position and position camera relative to player
    const translation = ref.current.translation()
    
    // Check for boundary crossings and update gravity + rotate player
    const currentPosition = new THREE.Vector3(translation.x, translation.y, translation.z);
    const boundary = checkBoundaries(currentPosition);
    if (boundary && setCurrentFace) {
      // Use the original changeGravity function which handles both gravity and player rotation
      changeGravity(boundary, ref.current, setCurrentFace, state.camera, currentFace);
    }
    
    // Only allow player movement if gravity is not changing
    if (!isChanging) {
      // Simple camera-relative movement
      direction.set(0, 0, 0)
      
      if (forward || backward || left || right) {
        // Ensure camera world matrix is up to date before getting direction
        state.camera?.updateMatrixWorld(true)
        
        // Use actual camera direction for movement (where the player is actually looking)
        const cameraForward = new THREE.Vector3()
        state.camera?.getWorldDirection(cameraForward)
        
        // Project camera forward onto the current face plane to get proper movement direction
        // Remove any component along the face's up direction to keep movement on the surface
        const faceUp = faceOrientation.upDirection.clone()
        const projectedForward = cameraForward.clone()
        const dotProduct = faceUp.dot(cameraForward)
        projectedForward.addScaledVector(faceUp, -dotProduct)
        
        // Calculate right direction by crossing projected forward with face up
        const cameraRight = new THREE.Vector3()
        cameraRight.crossVectors(projectedForward, faceUp).normalize()
        
        // Build movement direction from input using projected camera directions
        direction.set(0, 0, 0)
        if (forward) direction.add(projectedForward)
        if (backward) direction.sub(projectedForward)
        if (right) direction.add(cameraRight)
        if (left) direction.sub(cameraRight)
        
        // Normalize and apply speed
        if (direction.length() > 0) {
          direction.normalize().multiplyScalar(SPEED)
        }
      
        // Apply movement preserving only gravity component of velocity
        const currentVel = ref.current.linvel()
        const currentVelVector = new THREE.Vector3(currentVel.x, currentVel.y, currentVel.z)
        
        // Calculate gravity component of current velocity
        const gravityDirection = faceOrientation.upDirection.clone().multiplyScalar(-1) // Gravity points toward surface
        const gravityVelComponent = gravityDirection.multiplyScalar(gravityDirection.dot(currentVelVector))
        
        // New velocity = surface movement + gravity component
        const newVelocity = direction.clone().add(gravityVelComponent)
        
        ref.current.setLinvel({ 
          x: newVelocity.x,
          y: newVelocity.y,
          z: newVelocity.z
        })
      }
      
      // // Handle jumping - jump in the "up" direction relative to current face (keep this as-is)
      if (jump) {
        const currentVel = ref.current.linvel();
        const jumpForce = 1.0;
        const jumpVector = faceOrientation.upDirection.clone().multiplyScalar(jumpForce);
        
        ref.current.setLinvel({ 
          x: currentVel.x + jumpVector.x, 
          y: currentVel.y + jumpVector.y, 
          z: currentVel.z + jumpVector.z 
        });
      }
    }

    // Terrain manipulator - visual raycast from camera center
    const hitInfo = visualRaycast(state.camera, planetInstancedMesh.current)
    if (hitInfo) {
      // const material = planetInstanceMaterials.current[hitInfo.instanceIndex]
      // const rigidBody = planetRigidBodies.current[hitInfo.instanceIndex]
      
      // console.log("✅ Hit voxel:", {
      //   instanceIndex: hitInfo.instanceIndex,
      //   material: material,
      //   distance: hitInfo.distance,
      //   position: rigidBody?.translation(),
      //   userData: rigidBody?.userData,
      //   point: hitInfo.point,
      //   normal: hitInfo.normal,
      // });
      
    }
  })
  
  return (
    <>
    <RigidBody ref={ref} colliders={false} mass={1} type="dynamic" position={[0, 15, 0]} enabledRotations={[false, false, false]} lockRotations>
        <mesh position={[0, 0, 0]}>
        <CapsuleCollider args={[.5, .5]} />
          <PerspectiveCamera ref={cameraRef} position={[0, 1, 0]} makeDefault fov={75} />
          <capsuleGeometry args={[0.5, 0.5]} />
          <meshStandardMaterial color="red" />
        </mesh>
      </RigidBody>
    </>
  )
} 
