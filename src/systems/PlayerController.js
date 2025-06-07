import * as THREE from 'three';
import { WORLD_CONFIG } from '../constants/world';
import { globalCollisionSystem } from '../utils/VoxelCollisionSystem';

/**
 * PlayerBodyRig - Represents the player's body as a 3-block column
 * Automatically maintains orientation relative to planet surface
 */
class PlayerBodyRig {
  constructor(planetCenter, planetRadius) {
    this.planetCenter = planetCenter;
    this.planetRadius = planetRadius;
    
    // Body structure (3 blocks)
    this.blockHeight = 1.0; // Height of each block
    this.position = new THREE.Vector3(); // World position (center of torso)
    
    // Body orientation (automatically calculated)
    this.upDirection = new THREE.Vector3(0, 1, 0);     // Head to feet direction (away from planet)
    this.forwardDirection = new THREE.Vector3(0, 0, 1); // Forward direction (tangent to surface)
    this.rightDirection = new THREE.Vector3(1, 0, 0);   // Right direction (tangent to surface)
  }
  
  /**
   * Update body orientation based on current position
   */
  updateOrientation() {
    // Calculate surface normal (feet point toward center, head away from center)
    const toPlanetCenter = this.planetCenter.clone().sub(this.position);
    this.upDirection = toPlanetCenter.clone().normalize().multiplyScalar(-1); // Away from center
    
    // Create stable tangent coordinate system
    // Try Z-axis first as reference
    let referenceForward = new THREE.Vector3(0, 0, 1);
    
    // If Z is too close to up direction, use X-axis
    if (Math.abs(referenceForward.dot(this.upDirection)) > 0.9) {
      referenceForward = new THREE.Vector3(1, 0, 0);
    }
    
    // Create right direction perpendicular to up
    this.rightDirection = referenceForward.clone().cross(this.upDirection).normalize();
    
    // Create forward direction perpendicular to both up and right
    this.forwardDirection = this.upDirection.clone().cross(this.rightDirection).normalize();
  }
  
  /**
   * Get world position of head (where camera should be)
   */
  getHeadPosition() {
    return this.position.clone().add(this.upDirection.clone().multiplyScalar(this.blockHeight));
  }
  
  /**
   * Get world position of feet
   */
  getFeetPosition() {
    return this.position.clone().sub(this.upDirection.clone().multiplyScalar(this.blockHeight));
  }
  
  /**
   * Set body position and update orientation
   */
  setPosition(newPosition) {
    this.position.copy(newPosition);
    this.updateOrientation();
  }
  
  /**
   * Get rotation matrix for body orientation
   */
  getOrientationMatrix() {
    const matrix = new THREE.Matrix4();
    matrix.makeBasis(this.rightDirection, this.upDirection, this.forwardDirection.clone().negate());
    return matrix;
  }
}

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
    
    // Spherical camera orientation (relative to surface)
    this.cameraYaw = 0;   // Rotation around surface normal (look left/right)
    this.cameraPitch = 0; // Rotation around surface tangent (look up/down)
    
    // Stable reference direction for consistent coordinate system
    this.referenceDirection = new THREE.Vector3(0, 0, 1); // Start facing Z-direction
    
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
    
    // Initialize player position on planet surface
    this.position = this.getInitialSurfacePosition();
    this.camera.position.copy(this.position);
    
    // Initialize camera orientation to match surface
    this.initializeCameraOrientation();
    
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
    
    // Update camera orientation to maintain surface alignment even in dev mode
    this.updateCameraOrientation();
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
    const surfaceNormal = this.getRadialDirection(); // "Up" direction at current position
    
    // Project the stable reference direction onto the current tangent plane
    // This maintains continuity and prevents coordinate system flips
    let tangentForward = this.referenceDirection.clone().sub(
      surfaceNormal.clone().multiplyScalar(this.referenceDirection.dot(surfaceNormal))
    );
    
    // If the reference direction becomes too aligned with surface normal (near poles),
    // use the current camera forward direction projected onto tangent plane
    if (tangentForward.length() < 0.1) {
      const currentForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      tangentForward = currentForward.clone().sub(
        surfaceNormal.clone().multiplyScalar(currentForward.dot(surfaceNormal))
      );
      
      // If still too small, use emergency fallback
      if (tangentForward.length() < 0.1) {
        // Find any vector perpendicular to surface normal
        if (Math.abs(surfaceNormal.x) < 0.9) {
          tangentForward = new THREE.Vector3(1, 0, 0).cross(surfaceNormal);
        } else {
          tangentForward = new THREE.Vector3(0, 1, 0).cross(surfaceNormal);
        }
      }
    }
    
    tangentForward.normalize();
    
    // Update reference direction to maintain continuity for next frame
    this.referenceDirection.copy(tangentForward);
    
    // Create orthogonal tangent coordinate system
    const tangentRight = tangentForward.clone().cross(surfaceNormal).normalize();
    
    // Apply camera yaw around surface normal
    const yawRotation = new THREE.Quaternion().setFromAxisAngle(surfaceNormal, this.cameraYaw);
    const rotatedForward = tangentForward.clone().applyQuaternion(yawRotation);
    const rotatedRight = tangentRight.clone().applyQuaternion(yawRotation);
    
    // Apply camera pitch around the rotated right axis
    const clampedPitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, this.cameraPitch));
    const pitchRotation = new THREE.Quaternion().setFromAxisAngle(rotatedRight, clampedPitch);
    const finalForward = rotatedForward.clone().applyQuaternion(pitchRotation);
    const finalUp = surfaceNormal.clone().applyQuaternion(pitchRotation);
    
    // Recalculate right to maintain orthogonality
    const finalRight = finalForward.clone().cross(finalUp).normalize();
    
    // Build rotation matrix (Three.js uses -Z as forward)
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(finalRight, finalUp, finalForward.clone().negate());
    
    // Apply to camera with smoothing for smooth transitions
    const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix);
    this.camera.quaternion.slerp(targetQuaternion, this.orientationSmoothness);
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
    this.cameraYaw = yaw;
    this.cameraPitch = pitch;
    // Camera orientation will be updated automatically in the next frame
  }

  /**
   * Reset player to surface position (useful for testing)
   */
  resetToSurface() {
    this.position.copy(this.getInitialSurfacePosition());
    this.camera.position.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    this.initializeCameraOrientation();
  }

  /**
   * Get initial position on planet surface
   */
  getInitialSurfacePosition() {
    // For cubic planet, place player ON the TOP face surface
    const surfacePosition = this.planetCenter.clone();
    surfacePosition.y += this.planetRadius + 2; // Just 2 units above TOP face for safety
    return surfacePosition;
  }

  /**
   * Initialize camera orientation to match surface
   */
  initializeCameraOrientation() {
    // Safety check to ensure everything is initialized
    if (!this.position || !this.camera || !this.planetCenter) {
      return;
    }
    
    // Set initial camera orientation values for a good starting view
    this.cameraYaw = 0;
    this.cameraPitch = 0;
    
    // Calculate proper initial orientation
    const surfaceNormal = this.getRadialDirection();
    
    // Set up initial reference direction projected onto surface
    let initialReference = new THREE.Vector3(0, 0, 1);
    if (Math.abs(initialReference.dot(surfaceNormal)) > 0.9) {
      initialReference = new THREE.Vector3(1, 0, 0);
    }
    
    // Project reference onto tangent plane
    const initialForward = initialReference.clone().sub(
      surfaceNormal.clone().multiplyScalar(initialReference.dot(surfaceNormal))
    ).normalize();
    
    // Store this as our stable reference direction
    this.referenceDirection.copy(initialForward);
    
    const initialRight = initialForward.clone().cross(surfaceNormal).normalize();
    
    // Set camera to look forward tangentially
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeBasis(initialRight, surfaceNormal, initialForward.clone().negate());
    
    this.camera.quaternion.setFromRotationMatrix(rotationMatrix);
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