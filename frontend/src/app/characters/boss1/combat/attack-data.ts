// ============================================================================
// BOSS1 ATTACK DATA
// ============================================================================
// All Boss1-specific attack configurations
// Boss1 (Jester) has two attacks: heavy (attack) and light (attack2)
// ============================================================================

import type { AttackConfig } from '../../../core/config';

export type Boss1AttackId = 
  | 'boss1_heavy'   // Main attack animation
  | 'boss1_light';  // Quick attack (attack2)

/**
 * Boss1 attack configurations
 * Boss is a heavy hitter with slower but more damaging attacks
 */
export const BOSS1_ATTACK_DATA: Record<Boss1AttackId, AttackConfig> = {
  // Heavy attack - slow wind-up, big damage
  boss1_heavy: {
    id: 'boss1_heavy',
    loadout: 'bare',  // Boss uses 'bare' loadout (no weapon switching)
    command: 'heavy',
    damage: 35,
    knockback: 120,
    zone: 'center',
    range: 300,           // Boss has long reach with weapons
    durationTicks: 90,    // ~1.5 seconds (animation is long)
    cooldownTicks: 30,    // Half second cooldown
    specialCharge: 15,
    pressureCharge: 25,
    engageRange: 500,     // Boss engages from further away
    superArmor: true,     // Boss has super armor during heavy attack
    telegraph: {
      freezeAtSpineFrame: 20,     // Animation pauses at wind-up frame
      freezeDurationMs: 200,  // Long telegraph for boss - can adjust per phase!
    },
  },
  
  // Light attack - quicker poke
  boss1_light: {
    id: 'boss1_light',
    loadout: 'bare',
    command: 'light',
    damage: 15,
    knockback: 40,
    zone: 'center',
    range: 300,
    durationTicks: 60,    // ~1 second
    cooldownTicks: 10,    // Short cooldown
    specialCharge: 8,
    pressureCharge: 12,
    engageRange: 500,
  },
};
