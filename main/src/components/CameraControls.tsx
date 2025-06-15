import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayer } from '../context/PlayerContext'

interface CameraControlsProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
}

function CameraControls({ cameraRef }: CameraControlsProps) {
  // Simple yaw/pitch mouse look state
  const cameraAngles = useRef({ yaw: 0, pitch: 0 })
  const isLockedRef = useRef(false)
  const { faceOrientation } = usePlayer()
  
  // Pointer lock controls
  useEffect(() => {
    const handleClick = async () => {
      // Only request pointer lock if not already locked and no active lock
      if (!document.pointerLockElement) {
        try {
          await document.body.requestPointerLock()
        } catch (error) {
          console.warn('Pointer lock request failed:', error)
          // Don't throw error, just continue without pointer lock
        }
      }
    }
    
    const handlePointerLockChange = () => {
      const isLocked = document.pointerLockElement === document.body
      isLockedRef.current = isLocked
      
      // Log state changes for debugging
      if (isLocked) {
        console.log('🔒 Pointer lock acquired')
      } else {
        console.log('🔓 Pointer lock released')
      }
    }
    
    const handlePointerLockError = (event: Event) => {
      console.warn('Pointer lock error:', event)
      isLockedRef.current = false
    }
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!isLockedRef.current) return
      
      const sensitivity = 0.002
      
      // Simple yaw/pitch updates
      cameraAngles.current.yaw -= event.movementX * sensitivity
      cameraAngles.current.pitch -= event.movementY * sensitivity
      
      // Clamp pitch to prevent over-rotation
      cameraAngles.current.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraAngles.current.pitch))
    }
    
    const handleKeyDown = (event: KeyboardEvent) => {
      // Press 'L' to re-lock pointer when controls are lost
      if (event.key.toLowerCase() === 'l' && !document.pointerLockElement) {
        handleClick()
      }
      // Press 'Escape' to ensure pointer lock is fully released
      if (event.key === 'Escape' && document.pointerLockElement) {
        document.exitPointerLock()
      }
    }
    
    document.addEventListener('click', handleClick)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('pointerlockerror', handlePointerLockError)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('pointerlockerror', handlePointerLockError)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
  
  // Update camera rotation each frame
  useFrame(() => {
    if (cameraRef.current) {
      // Simple approach: just set rotation directly
      cameraRef.current.rotation.set(
        cameraAngles.current.pitch,
        cameraAngles.current.yaw,
        0,
        'YXZ' // Apply yaw first, then pitch
      )
    }
  })

  return null // This component doesn't render anything
}

export default CameraControls 