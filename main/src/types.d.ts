import { Object3D, AmbientLight, DirectionalLight, HemisphereLight } from 'three'
import { ThreeElements } from '@react-three/fiber'

declare global {
  namespace React {
    namespace JSX {
        interface IntrinsicElements extends ThreeElements {
        }
    }
  }
}

declare module '@react-three/fiber' {
  interface ThreeElements {
    mesh: JSX.IntrinsicElements['mesh']
    ambientLight: JSX.IntrinsicElements['ambientLight']
    directionalLight: JSX.IntrinsicElements['directionalLight']
    hemisphereLight: JSX.IntrinsicElements['hemisphereLight']
    primitive: JSX.IntrinsicElements['primitive'] & { object: Object3D }
  }
} 