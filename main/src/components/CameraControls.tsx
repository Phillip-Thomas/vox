import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { usePlayer } from '../context/PlayerContext'

interface CameraControlsProps {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
}

export default function CameraControls({ cameraRef }: CameraControlsProps) {
  // Simple yaw/pitch mouse look state
  const cameraAngles = useRef({ yaw: 0, pitch: 0 })
  const isLockedRef = useRef(false)
  const { faceOrientation } = usePlayer()
  
  // Pointer lock controls
  useEffect(() => {
    const handleClick = () => {
      document.body.requestPointerLock()
    }
    
    const handlePointerLockChange = () => {
      isLockedRef.current = document.pointerLockElement === document.body
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
    
    document.addEventListener('click', handleClick)
    document.addEventListener('pointerlockchange', handlePointerLockChange)
    document.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('pointerlockchange', handlePointerLockChange)
      document.removeEventListener('mousemove', handleMouseMove)
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