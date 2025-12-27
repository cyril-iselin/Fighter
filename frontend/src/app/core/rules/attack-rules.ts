// ============================================================================
// ATTACK RULES - Simplified Attack Logic
// ============================================================================
// Pure Core rules operating on Fighter state + AttackConfig
// No complex cancel system - let animations drive timing
// ============================================================================

import type { Fighter, GameEvent, HitZone } from '../types';
import { PARRY_WINDOW_TICKS } from '../config';
import { getAttackData } from '../../adapters/attack-resolver';import type { AttackId } from '../attack-types';import { forceTransition } from '../state-machine';

// ============================================================================
// CANCEL SYSTEM
// ============================================================================

export function canCancelIntoMovement(fighter: Fighter): boolean {
  return false;
}

export function canCancelIntoJump(fighter: Fighter): boolean {
  return false;
}

/**
 * Can cancel into block from:
 * - Recovery state (always)
 * - Light attacks (for defensive cancel)
 */
export function canCancelIntoBlock(fighter: Fighter): boolean {
  // Allow canceling light attacks into block
  if ((fighter.state === 'attack' || fighter.state === 'telegraph') && fighter.activeAttack) {
    const attackConfig = getAttackData(fighter.characterId, fighter.activeAttack || '');
    return attackConfig?.command === 'light';
  }
  
  return false;
}

/**
 * Simplified: No attack canceling for now
 */
export function canCancelIntoAttack(fighter: Fighter): boolean {
  return false;
}

/**
 * Execute cancel into movement (reset to idle)
 */
export function executeCancelIntoMovement(fighter: Fighter): void {
  fighter.activeAttack = null;
  fighter.attackInstanceId = 0;
  forceTransition(fighter, 'idle');
  fighter.stateTicks = 0;
}

/**
 * Execute cancel into new attack (simplified - no canceling)
 */
export function executeCancelIntoAttack(
  fighter: Fighter,
  newAttackId: AttackId,
  currentTick: number
): GameEvent[] {
  // Simplified: Just start new attack
  return startAttack(fighter, newAttackId, currentTick);
}

// ============================================================================
// ATTACK STATE MANAGEMENT (Simplified)
// ============================================================================

/**
 * Attack start - with telegraph for attacks that have telegraph config
 * 
 * NEW TELEGRAPH SYSTEM:
 * - Animation plays to freezeAtSpineFrame, then PAUSES for freezeDurationMs
 * - The pause is purely visual (handled by presenter)
 * - Core converts Spine frames to ticks (×2 for 30fps → 60Hz)
 * - When total time elapsed, transition to attack state
 * - stateTicks in attack will sync with animation frames
 */
export function startAttack(fighter: Fighter, attackId: AttackId, currentTick: number): GameEvent[] {
  const attackConfig = getAttackData(fighter.characterId || 'stickman', attackId);
  const events: GameEvent[] = [];

  fighter.activeAttack = attackId;
  fighter.attackInstanceId = currentTick;
  fighter.attackLandedHit = false;  // Reset whiff tracking

  // Telegraph phase for attacks with telegraph config
  if (attackConfig.telegraph && attackConfig.telegraph.freezeDurationMs > 0) {
    forceTransition(fighter, 'telegraph');
    fighter.stateTicks = 0;
    events.push({
      type: 'telegraph',
      fighter: fighter.id,
      attack: attackId,
    });
  } else {
    // Direct to attack state for normal attacks (no telegraph)
    forceTransition(fighter, 'attack');
    fighter.stateTicks = 0;
    events.push({
      type: 'attackStart',
      fighter: fighter.id,
      attack: attackId,
    });
  }

  return events;
}

/**
 * Attack progression with telegraph support
 * 
 * Telegraph timing:
 * - Total telegraph time = freezeAtSpineFrame (×2 for ticks) + freezeDurationMs (converted to ticks)
 * - This ensures animation plays to freeze frame, holds, then attack continues from there
 */
export function progressAttackState(fighter: Fighter): GameEvent[] {
  const events: GameEvent[] = [];
  
  if (!fighter.activeAttack) return events;

  const attackId = fighter.activeAttack as AttackId;
  const attackConfig = getAttackData(fighter.characterId || 'stickman', attackId);
  
  // Telegraph → Attack
  if (fighter.state === 'telegraph') {
    const telegraph = attackConfig.telegraph;
    if (!telegraph) {
      // No telegraph config - shouldn't happen, but transition immediately
      forceTransition(fighter, 'attack');
      fighter.stateTicks = 0;
      events.push({ type: 'attackStart', fighter: fighter.id, attack: attackId });
      return events;
    }
    
    // Check for phase-based telegraph duration override
    const baseFreezeMs = telegraph.freezeDurationMs;
    const overrideMs = fighter.telegraphOverrides?.[attackId];
    const freezeDurationMs = overrideMs ?? baseFreezeMs;
    
    // Convert Spine frame to game ticks (Spine: 30fps, Game: 60Hz → ×2)
    const SPINE_TO_TICKS = 2;
    const freezeAtTicks = telegraph.freezeAtSpineFrame * SPINE_TO_TICKS;
    
    // Total telegraph duration:
    // - Time to reach freeze frame (spineFrame × 2 ticks @ 60Hz)
    // - Plus the freeze hold duration (freezeDurationMs - can be overridden per phase!)
    const framePlayTicks = freezeAtTicks;
    const freezeHoldTicks = Math.ceil((freezeDurationMs / 1000) * 60);
    const totalTelegraphTicks = framePlayTicks + freezeHoldTicks;
    
    if (fighter.stateTicks >= totalTelegraphTicks) {
      forceTransition(fighter, 'attack');
      // KEY: stateTicks starts at freezeAtTicks, matching where animation resumes!
      fighter.stateTicks = freezeAtTicks;
      events.push({
        type: 'attackStart',
        fighter: fighter.id,
        attack: attackId,
      });
    }
    return events;
  }
  
  // Attack → Idle (let animation handle timing)
  if (fighter.state === 'attack') {
    const attackDuration = attackConfig.durationTicks;

    if (fighter.stateTicks >= attackDuration) {
      // Generate whiff event if attack didn't land
      if (!fighter.attackLandedHit) {
        events.push({
          type: 'whiff',
          attacker: fighter.id,
          attack: attackId,
        });
      }
      
      // Go directly to idle
      fighter.activeAttack = null;
      fighter.attackInstanceId = 0;
      fighter.attackLandedHit = false;
      
      // Set cooldown for next attack
      fighter.cooldownTicks = attackConfig.cooldownTicks ?? 0;
      
      forceTransition(fighter, 'idle');
      fighter.stateTicks = 0;
    }
  }

  return events;
}