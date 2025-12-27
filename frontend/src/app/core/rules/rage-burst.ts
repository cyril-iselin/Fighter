// ============================================================================
// RAGE BURST SYSTEM (Proximity-Based)
// ============================================================================
// When the player stays too close to the boss for too long, the boss triggers
// a "rage burst" that knocks back the player. This prevents players from
// standing in melee range indefinitely and forces spacing gameplay.
// 
// Configuration is per-boss-phase via BossPhase.rageBurst
// ============================================================================

import type { Fighter, GameEvent } from '../types';

/**
 * Rage burst configuration (set per boss phase)
 */
export interface RageBurstConfig {
  /** Distance threshold - player must be closer than this (pixels) */
  proximityThreshold: number;
  
  /** Ticks player must stay in proximity to trigger burst */
  durationTicks: number;
  
  /** Cooldown before another burst can trigger (ticks) */
  cooldownTicks: number;
  
  /** Knockback force applied to player */
  knockbackStrength: number;
}

/** Default config (can be overridden per phase) */
export const DEFAULT_RAGE_BURST_CONFIG: RageBurstConfig = {
  proximityThreshold: 150,    // Player must be within 150px
  durationTicks: 120,         // ~2 seconds at 60fps
  cooldownTicks: 300,         // ~5 seconds between bursts
  knockbackStrength: 2000,    // Strong knockback
};

/**
 * Track proximity and check for rage burst trigger
 * Call this every tick from game-loop for AI fighters
 * 
 * @param boss - The AI fighter (boss)
 * @param player - The player fighter
 * @param distance - Current distance between fighters
 * @param currentTick - Current game tick
 * @param config - Optional override config (from boss phase)
 * @returns GameEvent if rage burst triggered, null otherwise
 */
export function checkProximityRageBurst(
  boss: Fighter,
  player: Fighter,
  distance: number,
  currentTick: number,
  config?: Partial<RageBurstConfig>
): GameEvent | null {
  const cfg = { ...DEFAULT_RAGE_BURST_CONFIG, ...config };
  
  // Check if rage burst is on cooldown
  if (currentTick < boss.rageBurstCooldownTick) {
    // Debug: Log cooldown status occasionally
    if (currentTick % 60 === 0) {
      console.log(`[RageBurst] On cooldown until tick ${boss.rageBurstCooldownTick}, current: ${currentTick}`);
    }
    return null;
  }
  
  // Check if player is in proximity
  const inProximity = distance < cfg.proximityThreshold;
    
  if (inProximity) {
    // Increment proximity counter
    boss.proximityTicks = (boss.proximityTicks ?? 0) + 1;
        
    // Check if threshold reached
    if (boss.proximityTicks >= cfg.durationTicks) {
      // Trigger rage burst!
      applyRageBurstKnockback(boss, player, cfg.knockbackStrength);
      
      // Reset tracking and set cooldown
      boss.proximityTicks = 0;
      boss.rageBurstCooldownTick = currentTick + cfg.cooldownTicks;
      
      console.log(`[RageBurst] 💥 TRIGGERED! Cooldown until tick ${boss.rageBurstCooldownTick}`);
      
      return {
        type: 'rageBurst',
        fighter: boss.id,
        target: player.id,
      };
    }
  } else {
    // Player moved away - reset counter
    if (boss.proximityTicks > 0) {
      console.log(`[RageBurst] Player moved away, resetting proximity counter`);
    }
    boss.proximityTicks = 0;
  }
  
  return null;
}

/**
 * Apply knockback to player (push away from boss)
 */
function applyRageBurstKnockback(boss: Fighter, player: Fighter, strength: number): void {
  // Push player away from boss
  const direction = boss.x < player.x ? 1 : -1;
  player.impulseVx += direction * strength;
}

/**
 * Check if rage burst can be triggered (for AI decision making)
 */
export function canTriggerRageBurst(boss: Fighter, currentTick: number): boolean {
  return currentTick >= boss.rageBurstCooldownTick;
}

/**
 * Get rage burst progress (0-1) for UI display
 */
export function getRageBurstProgress(boss: Fighter, config?: Partial<RageBurstConfig>): number {
  const cfg = { ...DEFAULT_RAGE_BURST_CONFIG, ...config };
  return Math.min(1, (boss.proximityTicks ?? 0) / cfg.durationTicks);
}
