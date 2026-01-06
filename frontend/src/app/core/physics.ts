import type { Fighter } from './types';
import { PHYSICS, TICK_RATE } from './config';

const DT = 1 / TICK_RATE;  // Fixed timestep: 1/60 = 0.0166... seconds

// ============================================================================
// COORDINATE SYSTEM (Screen/Canvas coordinates):
// - Y increases DOWNWARD (higher Y = lower on screen)
// - groundY = low value (floor level near top of viewport)
// - jumping: velocityY < 0 (negative = up), falling: velocityY > 0 (positive = down)
// - gravity pulls velocityY downward (adds to vy)
// ============================================================================

// ============================================================================
// MOVEMENT
// ============================================================================

/**
 * Applies horizontal movement with separated movement and impulse velocities
 */
export function applyMovement(fighter: Fighter): void {
  // Combine movement and impulse velocities FIRST
  fighter.vx = fighter.moveVx + fighter.impulseVx;
  
  // Apply position change
  fighter.x += fighter.vx * DT;
  
  // THEN apply physics damping to impulse velocity
  fighter.impulseVx *= 0.92;
  
  // Stop impulse if very small to prevent endless sliding
  if (Math.abs(fighter.impulseVx) < 0.5) {
    fighter.impulseVx = 0;
  }
}

// ============================================================================
// GRAVITY & JUMP (Legacy-compatible: Y+ is UP)
// ============================================================================

/**
 * Applies gravity to vertical velocity
 * Gravity pulls DOWN (increases vy in screen coordinates)
 */
export function applyGravity(fighter: Fighter): void {
  // Apply gravity if in air (below ground in screen coords = higher Y)
  if (fighter.y < PHYSICS.groundY || fighter.vy < 0) {
    fighter.vy += PHYSICS.gravity * DT;  // Gravity pulls DOWN (Y+ direction)
  }
}

/**
 * Applies vertical velocity
 */
export function applyVerticalVelocity(fighter: Fighter): void {
  fighter.y += fighter.vy * DT;
}

/**
 * Checks if fighter is on ground
 * Simple check: Y at or below ground level
 */
export function isOnGround(fighter: Fighter): boolean {
  return fighter.y >= PHYSICS.groundY;
}

/**
 * Checks if fighter was airborne and just landed
 */
export function checkLanding(fighter: Fighter): boolean {
  return fighter.state === 'jump' && isOnGround(fighter);
}

/**
 * Clamps fighter to ground
 */
export function clampToGround(fighter: Fighter): void {
  if (fighter.y > PHYSICS.groundY) {
    fighter.y = PHYSICS.groundY;
    fighter.vy = 0;
  }
}

// ============================================================================
// POSITION CONSTRAINTS
// ============================================================================

/**
 * Clamps fighter position to arena bounds
 */
export function clampToArenaBounds(fighter: Fighter): void {
 if (fighter.x < PHYSICS.minX) {
    fighter.x = PHYSICS.minX;

    // kill outward velocity/impulse
    if (fighter.vx < 0) {
      fighter.vx = 0;
      if (fighter.impulseVx < 0) fighter.impulseVx = 0;
    }
  }

  if (fighter.x > PHYSICS.maxX) {
    fighter.x = PHYSICS.maxX;

    // kill outward velocity/impulse
    if (fighter.vx > 0) {
      fighter.vx = 0;
      if (fighter.impulseVx > 0) fighter.impulseVx = 0;
    }
  }
}

/**
 * Enforces minimum distance between fighters (grounded-only collision)
 */
export function enforceMinDistance(f0: Fighter, f1: Fighter): void {
  // Only enforce collision if both fighters are grounded (prevents cross-up)
  if (!isOnGround(f0) || !isOnGround(f1)) {
    return; // Airborne fighters can pass through each other
  }
  
  const distance = Math.abs(f1.x - f0.x);
  
  if (distance < PHYSICS.minDistance) {
    const overlap = PHYSICS.minDistance - distance;
    const halfOverlap = overlap / 2;
    
    // Symmetric pushback for grounded fighters only
    if (f0.x < f1.x) {
      f0.x -= halfOverlap;
      f1.x += halfOverlap;
    } else {
      f0.x += halfOverlap;
      f1.x -= halfOverlap;
    }
  }
}

/**
 * Updates facing direction based on opponent position
 */
export function updateFacing(f0: Fighter, f1: Fighter): void {
  const FACING_DEADZONE = 10; // pixels deadzone to prevent flicker
  
  // Only update facing if not in an action that locks facing
  if (canChangeFacing(f0)) {
    // Lock facing while airborne to prevent cross-up flicker
    if (isOnGround(f0)) {
      const dx = f1.x - f0.x;
      // Only change facing if opponent is clearly on one side (outside deadzone)
      if (Math.abs(dx) > FACING_DEADZONE) {
        f0.facingRight = dx > 0;
      }
    }
    // If airborne: keep current facing (no change)
  }
  
  if (canChangeFacing(f1)) {
    // Lock facing while airborne to prevent cross-up flicker
    if (isOnGround(f1)) {
      const dx = f0.x - f1.x;
      // Only change facing if opponent is clearly on one side (outside deadzone)
      if (Math.abs(dx) > FACING_DEADZONE) {
        f1.facingRight = dx > 0;
      }
    }
    // If airborne: keep current facing (no change)
  }
}

function canChangeFacing(fighter: Fighter): boolean {
  // Cannot change facing during: attack, telegraph, hurt
  if (!isOnGround(fighter)) return false;
  return fighter.state !== 'attack' 
    && fighter.state !== 'telegraph'
    && fighter.state !== 'hurt';
}
