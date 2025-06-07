import * as THREE from 'three';
import { WORLD_CONFIG } from '../constants/world';
import { globalCollisionSystem } from '../utils/VoxelCollisionSystem';

/**
 * PlayerController - Modular locomotion system for spherical planets
 * Built specifically for radial gravity and scalable movement systems
 */
export class PlayerController {
  constructor(camera) {
    this.camera = camera;
    
    // Core state
    this.velocity = new THREE.Vector3();
    this.isGrounded = true;
    
    // Planet references
    this.planetCenter = new THREE.Vector3(...WORLD_CONFIG.PLANET.GRAVITY.CENTER);
    this.planetRadius = WORLD_CONFIG.PLANET.SIZE;
    
    // Initialize player position on planet surface
    this.position = this.getInitialSurfacePosition();
    this.camera.position.copy(this.position);
    
    // Initialize camera orientation to match surface
    this.initializeCameraOrientation();
    
    // Movement parameters
    this.moveSpeed = 0.02; // Much slower for planet scale
    this.jumpForce = 2.5; // Much stronger jump force
    this.gravityStrength = WORLD_CONFIG.PLANET.GRAVITY.STRENGTH;
    this.velocityDamping = 0.85; // Reduce velocity buildup
    
    // Jump state management
    this.jumpCooldown = 100; // ms
    this.lastJumpTime = 0;
    
    // Orientation smoothing
    this.orientationSmoothness = 0.15; // More responsive camera adjustment
    this.allowCameraControl = true; // Allow external camera control (drag controls)
    
    // Relative camera rotation from drag controls
    this.relativeYaw = 0;
    this.relativePitch = 0;
    
    // Input state (will be set externally)
    this.inputState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      up: false,    // Dev mode
      down: false   // Dev mode
    };
  }

  /**
   * Update player state - call this every frame
   */
  update(deltaTime, mode = 'player') {
    if (mode === 'dev') {
      this.updateDevMode(deltaTime);
    } else {
      this.updatePlayerMode(deltaTime);
    }
    
    // Apply final position to camera
    this.camera.position.copy(this.position);
  }

  /**
   * Dev mode - free flying
   */
  updateDevMode(deltaTime) {
    const moveVector = new THREE.Vector3();
    
    if (this.inputState.forward) moveVector.z -= this.moveSpeed;
    if (this.inputState.backward) moveVector.z += this.moveSpeed;
    if (this.inputState.left) moveVector.x -= this.moveSpeed;
    if (this.inputState.right) moveVector.x += this.moveSpeed;
    if (this.inputState.up) moveVector.y += this.moveSpeed;
    if (this.inputState.down) moveVector.y -= this.moveSpeed;
    
    // Apply camera-relative movement
    if (moveVector.length() > 0) {
      const worldMovement = this.getCameraRelativeMovement(moveVector);
      this.position.add(worldMovement);
    }
    
    // Reset physics state in dev mode
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
  }

  /**
   * Player mode - radial gravity physics
   */
  updatePlayerMode(deltaTime) {
    // 1. Handle input and generate movement intent
    const movementIntent = this.calculateMovementIntent();
    
    // 2. Apply radial gravity
    this.applyRadialGravity();
    
    // 3. Handle jumping
    this.handleJumping();
    
    // 4. Apply tangential movement
    this.applyTangentialMovement(movementIntent);
    
    // 5. Apply physics and collision detection
    this.applyPhysics();
    
    // 6. Update camera orientation for planet surface
    this.updateCameraOrientation();
  }

  /**
   * Calculate movement intent from input
   */
  calculateMovementIntent() {
    const intent = new THREE.Vector3();
    
    if (this.inputState.forward) intent.z -= 1;
    if (this.inputState.backward) intent.z += 1;
    if (this.inputState.left) intent.x -= 1;
    if (this.inputState.right) intent.x += 1;
    
          // Debug logging removed
    
    return intent;
  }

  /**
   * Apply radial gravity toward planet center
   */
  applyRadialGravity() {
    const gravityDirection = this.planetCenter.clone().sub(this.position).normalize();
    const gravityForce = gravityDirection.multiplyScalar(this.gravityStrength);
    
    // Debug gravity occasionally
    if (Math.random() < 0.01) { // 1% chance to log
      console.log(`⬇️ Gravity Debug:`, {
        position: this.position.toArray(),
        planetCenter: this.planetCenter.toArray(),
        gravityDirection: gravityDirection.toArray(),
        gravityForce: gravityForce.toArray(),
        isGrounded: this.isGrounded
      });
    }
    
    // Only apply gravity if not grounded or if moving away from surface
    const radialVelocity = this.getRadialVelocityComponent();
    if (!this.isGrounded || radialVelocity > 0) {
      this.velocity.add(gravityForce);
    }
  }

  /**
   * Handle jumping logic
   */
  handleJumping() {
    const now = Date.now();
    const canJump = this.isGrounded && (now - this.lastJumpTime) > this.jumpCooldown;
    
    if (this.inputState.jump && canJump) {
      // Simple radial impulse away from planet center
      const jumpDirection = this.getRadialDirection();
      const jumpImpulse = jumpDirection.clone().multiplyScalar(this.jumpForce);
      
      const distanceFromCenter = this.position.distanceTo(this.planetCenter);
      console.log(`🚀 Jumping:`, {
        position: this.position.toArray(),
        planetCenter: this.planetCenter.toArray(),
        distanceFromCenter: distanceFromCenter.toFixed(2),
        expectedSurfaceDistance: this.planetRadius,
        jumpDirection: jumpDirection.toArray(), // This should be normalized
        jumpImpulse: jumpImpulse.toArray(),     // This should be jumpDirection * jumpForce
        jumpForce: this.jumpForce
      });
      
      // Add jump impulse to current velocity (don't replace, just add)
      this.velocity.add(jumpImpulse);
      
      this.isGrounded = false;
      this.lastJumpTime = now;
    }
  }

  /**
   * Apply movement tangent to planet surface
   */
  applyTangentialMovement(movementIntent) {
    if (movementIntent.length() === 0) return;
    
    // Get camera-relative movement
    const cameraMovement = this.getCameraRelativeMovement(movementIntent);
    
    // Project movement onto tangent plane (perpendicular to radial direction)
    const radialDirection = this.getRadialDirection();
    const tangentialMovement = cameraMovement.clone().sub(
      radialDirection.clone().multiplyScalar(cameraMovement.dot(radialDirection))
    );
    
    if (tangentialMovement.length() > 0) {
      tangentialMovement.normalize().multiplyScalar(this.moveSpeed);
      this.velocity.add(tangentialMovement);
      
      // Debug logging removed
    }
  }

  /**
   * Apply physics and collision detection
   */
  applyPhysics() {
    if (this.velocity.length() === 0) return;
    
    const targetPosition = this.position.clone().add(this.velocity);
    
    // Use collision system
    const collisionResult = globalCollisionSystem.checkPlayerCollision(
      this.position,
      targetPosition,
      this.velocity
    );
    
    // Update state from collision results
    this.position.copy(collisionResult.position);
    this.velocity.copy(collisionResult.velocity);
    this.isGrounded = collisionResult.onGround;
    
    // Apply velocity damping to prevent buildup
    this.velocity.multiplyScalar(this.velocityDamping);
  }

  /**
   * Update camera orientation to match planet surface
   */
  updateCameraOrientation() {
    const upDirection = this.getRadialDirection();
    
    if (this.allowCameraControl) {
      // Dev mode: basic orientation adjustment
      const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const tangentialForward = currentForward.clone().sub(
        upDirection.clone().multiplyScalar(currentForward.dot(upDirection))
      );
      
      if (tangentialForward.length() > 0.001) {
        tangentialForward.normalize();
        const rightDirection = new THREE.Vector3().crossVectors(tangentialForward, upDirection).normalize();
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeBasis(rightDirection, upDirection, tangentialForward.multiplyScalar(-1));
        const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
        this.camera.quaternion.slerp(targetQuaternion, this.orientationSmoothness);
      }
    } else {
      // Player mode: use relative rotations from drag controls
      const forward = new THREE.Vector3(0, 0, -1);
      const tangentialForward = forward.clone().sub(
        upDirection.clone().multiplyScalar(forward.dot(upDirection))
      ).normalize();
      
      const rightDirection = new THREE.Vector3().crossVectors(tangentialForward, upDirection).normalize();
      
      // Apply relative yaw rotation around the up direction
      const yawRotation = new THREE.Quaternion().setFromAxisAngle(upDirection, this.relativeYaw);
      const rotatedForward = tangentialForward.clone().applyQuaternion(yawRotation);
      const rotatedRight = rightDirection.clone().applyQuaternion(yawRotation);
      
      // Apply relative pitch rotation around the right direction
      const pitchRotation = new THREE.Quaternion().setFromAxisAngle(rotatedRight, this.relativePitch);
      const finalForward = rotatedForward.clone().applyQuaternion(pitchRotation);
      const finalUp = upDirection.clone().applyQuaternion(pitchRotation);
      
      // Recalculate right to maintain orthogonality
      const finalRight = new THREE.Vector3().crossVectors(finalForward, finalUp).normalize();
      
      // Create final rotation matrix and apply to camera
      const rotationMatrix = new THREE.Matrix4();
      rotationMatrix.makeBasis(finalRight, finalUp, finalForward.multiplyScalar(-1));
      
      const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
      this.camera.quaternion.copy(targetQuaternion);
    }
  }

  /**
   * Get camera-relative movement vector
   */
  getCameraRelativeMovement(localMovement) {
    // Get camera's local axes
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    
    // Build movement vector from camera's perspective
    const worldMovement = new THREE.Vector3();
    worldMovement.addScaledVector(forward, -localMovement.z); // Forward/backward
    worldMovement.addScaledVector(right, localMovement.x);    // Left/right
    worldMovement.addScaledVector(up, localMovement.y);       // Up/down (dev mode)
    
    return worldMovement;
  }

  /**
   * Get radial direction (away from planet center)
   */
  getRadialDirection() {
    const radial = this.position.clone().sub(this.planetCenter);
    const direction = radial.length() > 0 ? radial.normalize() : new THREE.Vector3(0, 1, 0);
    
    // Debug: log direction vectors occasionally 
    if (Math.random() < 0.01) { // 1% chance to log
      console.log(`🧭 Direction Debug:`, {
        position: this.position.toArray(),
        planetCenter: this.planetCenter.toArray(),
        radialDirection: direction.toArray(),
        distance: this.position.distanceTo(this.planetCenter).toFixed(2)
      });
    }
    
    return direction;
  }

  /**
   * Get velocity component in radial direction
   */
  getRadialVelocityComponent() {
    const radialDirection = this.getRadialDirection();
    return this.velocity.dot(radialDirection);
  }

  /**
   * Get velocity component tangent to planet surface
   */
  getTangentialVelocity() {
    const radialDirection = this.getRadialDirection();
    const radialComponent = radialDirection.clone().multiplyScalar(this.getRadialVelocityComponent());
    return this.velocity.clone().sub(radialComponent);
  }

  /**
   * Set input state from external input handler
   */
  setInputState(newInputState) {
    Object.assign(this.inputState, newInputState);
  }

  /**
   * Set relative rotation from drag controls
   */
  setRelativeRotation(yaw, pitch) {
    this.relativeYaw = yaw;
    this.relativePitch = pitch;
  }

  /**
   * Reset player to surface position (useful for testing)
   */
  resetToSurface() {
    this.position.copy(this.getInitialSurfacePosition());
    this.camera.position.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.relativeYaw = 0;
    this.relativePitch = 0;
    this.initializeCameraOrientation();
    // Debug logging removed
  }

  /**
   * Get initial position on planet surface
   */
  getInitialSurfacePosition() {
    // For cubic planet, place player ON the TOP face surface
    const surfacePosition = this.planetCenter.clone();
    surfacePosition.y += this.planetRadius + 2; // Just 2 units above TOP face for safety
    
    console.log(`🌍 Planet Setup:`, {
      planetCenter: this.planetCenter.toArray(),
      planetRadius: this.planetRadius,
      surfacePosition: surfacePosition.toArray(),
      planetTopFace: this.planetCenter.y + this.planetRadius,
      chunkBounds: `Y: 0 to ${256 * 0.25}`
    });
    
    return surfacePosition;
  }

  /**
   * Initialize camera orientation to match surface
   */
  initializeCameraOrientation() {
    // Force initial camera update to ensure proper orientation
    this.updateCameraOrientation();
    
    // Debug logging removed
  }

  /**
   * Get debug information
   */
  getDebugInfo() {
    return {
      position: this.position.clone(),
      velocity: this.velocity.clone(),
      isGrounded: this.isGrounded,
      distanceFromCenter: this.position.distanceTo(this.planetCenter),
      radialVelocity: this.getRadialVelocityComponent(),
      tangentialSpeed: this.getTangentialVelocity().length()
    };
  }
} 