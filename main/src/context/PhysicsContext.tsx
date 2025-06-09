import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import * as RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

interface PhysicsContextType {
  world: RAPIER.World | null;
  isInitialized: boolean;
  createRigidBody: (position: THREE.Vector3, size: THREE.Vector3, type: 'dynamic' | 'fixed') => RAPIER.RigidBody;
  removeRigidBody: (body: RAPIER.RigidBody) => void;
}

const PhysicsContext = createContext<PhysicsContextType>({
  world: null,
  isInitialized: false,
  createRigidBody: () => { throw new Error('Physics not initialized'); },
  removeRigidBody: () => { throw new Error('Physics not initialized'); }
});

export const usePhysics = () => useContext(PhysicsContext);

export const PhysicsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const worldRef = useRef<RAPIER.World | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initPhysics = async () => {
      try {
        // Initialize Rapier
        await RAPIER.init();
        
        // Create physics world
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        const world = new RAPIER.World(gravity);
        worldRef.current = world;

        // Create planet colliders
        const CUBE_SIZE = 10;
        const VOXEL_SIZE = 1.0;
        const offset = -(CUBE_SIZE * VOXEL_SIZE) / 2;

        // Create a single large collider for the planet
        const planetSize = (CUBE_SIZE * VOXEL_SIZE) / 2;
        const planetColliderDesc = RAPIER.ColliderDesc.cuboid(planetSize, planetSize, planetSize);
        planetColliderDesc.setTranslation(0, 0, 0);
        world.createCollider(planetColliderDesc);

        // Start physics loop
        const physicsLoop = () => {
          if (worldRef.current) {
            worldRef.current.step();
            requestAnimationFrame(physicsLoop);
          }
        };
        physicsLoop();

        setIsInitialized(true);

        return () => {
          if (worldRef.current) {
            worldRef.current.free();
          }
        };
      } catch (error) {
        console.error('Failed to initialize physics:', error);
      }
    };

    initPhysics();
  }, []);

  const createRigidBody = (position: THREE.Vector3, size: THREE.Vector3, type: 'dynamic' | 'fixed') => {
    if (!worldRef.current || !isInitialized) throw new Error('Physics not initialized');

    const rigidBodyDesc = type === 'dynamic' 
      ? RAPIER.RigidBodyDesc.dynamic()
      : RAPIER.RigidBodyDesc.fixed();

    rigidBodyDesc.setTranslation(position.x, position.y, position.z);
    const rigidBody = worldRef.current.createRigidBody(rigidBodyDesc);

    const colliderDesc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
    worldRef.current.createCollider(colliderDesc, rigidBody);

    return rigidBody;
  };

  const removeRigidBody = (body: RAPIER.RigidBody) => {
    if (!worldRef.current || !isInitialized) return;
    worldRef.current.removeRigidBody(body);
  };

  return (
    <PhysicsContext.Provider value={{
      world: worldRef.current,
      isInitialized,
      createRigidBody,
      removeRigidBody
    }}>
      {children}
    </PhysicsContext.Provider>
  );
}; 