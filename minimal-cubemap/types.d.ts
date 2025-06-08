import { Object3D } from 'three'

declare module '@react-three/fiber' {
  interface ThreeElements {
    mesh: JSX.IntrinsicElements['mesh'] & { ref?: React.RefObject<THREE.Mesh> }
    sphereGeometry: JSX.IntrinsicElements['sphereGeometry']
    meshStandardMaterial: JSX.IntrinsicElements['meshStandardMaterial']
    primitive: JSX.IntrinsicElements['primitive'] & { object: Object3D }
    ambientLight: JSX.IntrinsicElements['ambientLight']
    directionalLight: JSX.IntrinsicElements['directionalLight']
  }
} 