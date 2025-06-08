import { useThree, useFrame } from '@react-three/fiber';
import { usePlanet } from '../context/PlanetContext';
import { usePlayer } from '../context/PlayerContext';
import { useRef, useEffect } from 'react';
import * as THREE from 'three';



const GRAVITY = 9.8;
const SENS = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.05;

export default function Player() {
  const { camera, gl } = useThree();
  const { radius: RADIUS } = usePlanet();
  const { playerHeight: PLAYER_HEIGHT, moveSpeed } = usePlayer();
  const MOVE_SPEED = moveSpeed.walk;

  const playerPos = useRef(new THREE.Vector3(0, RADIUS + PLAYER_HEIGHT, 0));
  const velocity = useRef(new THREE.Vector3());
  const camQ = useRef(new THREE.Quaternion());
  const keys = useRef({});

  useEffect(() => {
    const down = e => { keys.current[e.code] = true; };
    const up = e => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const click = () => gl.domElement.requestPointerLock();
    window.addEventListener('click', click);
    return () => window.removeEventListener('click', click);
  }, [gl]);

  useEffect(() => {
    const mouseMove = e => {
      if (document.pointerLockElement !== gl.domElement) return;
      const upDir = playerPos.current.clone().normalize();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQ.current);
      const right = new THREE.Vector3().crossVectors(forward, upDir).normalize();

      const qYaw = new THREE.Quaternion().setFromAxisAngle(upDir, -e.movementX * SENS);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(right, -e.movementY * SENS);
      camQ.current.premultiply(qPitch).premultiply(qYaw);

      // clamp pitch
      const newFwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camQ.current);
      const tilt = Math.asin(THREE.MathUtils.clamp(newFwd.dot(upDir), -1, 1));
      if (tilt > MAX_PITCH) {
        camQ.current.premultiply(new THREE.Quaternion().setFromAxisAngle(right, tilt - MAX_PITCH));
      } else if (tilt < -MAX_PITCH) {
        camQ.current.premultiply(new THREE.Quaternion().setFromAxisAngle(right, tilt + MAX_PITCH));
      }
    };
    window.addEventListener('mousemove', mouseMove);
    return () => window.removeEventListener('mousemove', mouseMove);
  }, [gl]);

  const clock = new THREE.Clock();
  useFrame(() => {
    const dt = Math.min(clock.getDelta(), 0.05);

    // gravity
    const toCenter = playerPos.current.clone().negate();
    const upDir = playerPos.current.clone().normalize();
    velocity.current.add(toCenter.normalize().multiplyScalar(GRAVITY * dt));

    // WASD movement
    const input = new THREE.Vector2((keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0),
      (keys.current['KeyS'] ? 1 : 0) - (keys.current['KeyW'] ? 1 : 0));
    if (input.lengthSq() > 0) {
      input.normalize();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camQ.current);
      forward.sub(upDir.clone().multiplyScalar(forward.dot(upDir))).normalize();
      const right = new THREE.Vector3().crossVectors(forward, upDir).normalize();
      const moveDir = right.multiplyScalar(input.x).add(forward.multiplyScalar(-input.y)).normalize();
      playerPos.current.addScaledVector(moveDir, MOVE_SPEED * dt);
    }

    // update position from velocity
    playerPos.current.addScaledVector(velocity.current, dt);

    // stand on planet
    const radial = playerPos.current.length();
    if (radial < RADIUS + PLAYER_HEIGHT) {
      playerPos.current.normalize().multiplyScalar(RADIUS + PLAYER_HEIGHT);
      velocity.current.projectOnVector(upDir);
    }

    camera.position.copy(playerPos.current);
    camera.quaternion.copy(camQ.current);
    camera.up.copy(upDir);
  });

  return null;
} 