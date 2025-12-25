// ============================================
// Fighter Physics - Movement, Gravity & Collision
// ============================================

/**
 * Physics configuration for a fighter
 */
export interface PhysicsConfig {
  walkSpeed: number;
  runSpeed: number;
  jumpVelocity: number;
  gravity: number;
  groundY: number;
  minX: number;
  maxX: number;
}

/**
 * Default physics configuration
 */
export const DEFAULT_PHYSICS: PhysicsConfig = {
  walkSpeed: 200,
  runSpeed: 450,
  jumpVelocity: 700,
  gravity: 1800,
  groundY: 250,
  minX: 100,
  maxX: 1820
};

/**
 * Physics state for a fighter
 */
export interface PhysicsState {
  positionX: number;
  positionY: number;
  velocityX: number;
  velocityY: number;
  facingRight: boolean;
}

/**
 * Apply gravity and update position
 * @param deltaTime Time since last frame in SECONDS
 * @returns true if landed on ground this frame
 */
export function applyPhysics(
  state: PhysicsState, 
  config: PhysicsConfig, 
  deltaTime: number
): boolean {
  let landed = false;
  
  // Apply gravity if in air
  if (state.positionY > config.groundY || state.velocityY > 0) {
    state.velocityY -= config.gravity * deltaTime;
  }
  
  // Update position
  state.positionX += state.velocityX * deltaTime;
  state.positionY += state.velocityY * deltaTime;
  
  // Clamp to world boundaries
  state.positionX = Math.max(config.minX, Math.min(config.maxX, state.positionX));
  
  // Ground collision
  if (state.positionY < config.groundY) {
    if (state.velocityY < 0) {
      landed = true;
    }
    state.positionY = config.groundY;
    state.velocityY = 0;
  }
  
  return landed;
}

/**
 * Apply friction when not moving
 */
export function applyFriction(state: PhysicsState, friction: number = 0.8): void {
  state.velocityX *= friction;
  if (Math.abs(state.velocityX) < 1) {
    state.velocityX = 0;
  }
}

/**
 * Calculate movement velocity based on direction and speed
 */
export function calculateMoveVelocity(
  direction: 'left' | 'right' | 'none',
  isRunning: boolean,
  config: PhysicsConfig
): number {
  if (direction === 'none') return 0;
  
  const speed = isRunning ? config.runSpeed : config.walkSpeed;
  return direction === 'right' ? speed : -speed;
}

/**
 * Calculate jump velocity
 */
export function getJumpVelocity(config: PhysicsConfig): number {
  return config.jumpVelocity;
}

/**
 * Check if position is on ground
 */
export function isOnGround(positionY: number, groundY: number): boolean {
  return positionY <= groundY;
}

/**
 * Clamp position to world boundaries
 */
export function clampToWorld(x: number, minX: number, maxX: number): number {
  return Math.max(minX, Math.min(maxX, x));
}
