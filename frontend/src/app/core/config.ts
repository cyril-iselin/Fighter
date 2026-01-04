import type { Loadout, HitZone, AttackCommand } from './types';

// ============================================================================
// GENERIC GAME CONFIG
// ============================================================================
// Only gameplay-agnostic types, interfaces and shared constants
// Character-specific data lives in characters/<id>/... folders
// ============================================================================

/**
 * Generic Attack Configuration Interface
 * Character-specific attack data lives in characters/<id>/combat/attack-data.ts
 */
export interface AttackConfig {
  id: string; // Generic string instead of specific AttackId
  loadout: Loadout;
  command: AttackCommand;
  
  // Core combat values
  damage: number;
  knockback: number;         // Knockback force on hit (default: 0)
  zone: HitZone;             // Target zone for blocking
  range: number;             // Hit detection range
  durationTicks: number;     // Attack duration in game ticks (60Hz)
  cooldownTicks?: number;    // Cooldown after attack (default: 0 = no cooldown)
  
  // Multi-hit system
  multiHit?: boolean;        // Allow multiple hits from same attack instance
  hitInterval?: number;      // Ticks between hits for multi-hit attacks (default: 10)
  
  // Meter building
  specialCharge?: number;    // How much special meter this builds for player (0-100)
  pressureCharge?: number;   // How much pressure this builds on AI opponent (0-100)
  
  // Telegraph system - pause animation at specific frame for reaction time
  // Animation plays to freezeAtSpineFrame, PAUSES for freezeDurationMs, then continues
  // This does NOT affect hit window timing - only adds a visual pause!
  telegraph?: {
    freezeAtSpineFrame: number;  // Spine animation frame to freeze at (e.g. frame 10 in Spine editor)
    freezeDurationMs: number;    // How long to hold the freeze (adjustable per boss phase!)
  };
  
  // Super Armor (ignore hit-stun during active frames)
  superArmor?: boolean;      // Has super armor during active attack frames
  
  // AI behavior hint
  engageRange: number;       // Distance at which AI considers using this attack
}

// ============================================================================
// PHYSICS & GAME CONFIG
// ============================================================================

export const TICK_RATE = 60;

export const HEALTH_MAX = 500;
export const STUN_METER_MAX = 100;
export const SPECIAL_METER_MAX = 100;
export const PRESSURE_METER_MAX = 100;  // AI meter: increases when taking hits

// Combat Constants (simplified)
export const PARRY_WINDOW_TICKS = 10;  // 220ms @ 60Hz (parry window)
export const HURT_TICKS = 30;          // 500ms @ 60Hz
export const PRESSURE_STUN_TICKS = 120;  // 2000ms @ 60Hz (pressure stun duration)

// Damage Multipliers
export const HEAD_DAMAGE_MULTIPLIER = 1.3;  // 30% bonus damage for headshots

// Block Damage Reduction (based on zone mapping)
export const BLOCK_CORRECT_REDUCTION = 0.75;   // 75% reduction (25% damage taken)
export const BLOCK_WRONG_REDUCTION = 0.50;     // 50% reduction (50% damage taken)

export interface PhysicsConfig {
  walkSpeed: number;
  gravity: number;
  jumpVelocity: number;
  groundY: number;
  minX: number;
  maxX: number;
  minDistance: number;
}

export const PHYSICS: PhysicsConfig = {
  walkSpeed: 200,      // px/sec
  gravity: 1800,       // px/sec²
  jumpVelocity: 1000,  // px/sec (stark erhöht für sofortigen Upward-Push)
  groundY: 50,         // Niedriger Wert = oben auf Screen (Y+ geht nach unten!)
  minX: 100,
  maxX: 1820,
  minDistance: 120,
};
