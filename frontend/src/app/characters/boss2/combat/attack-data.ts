// ============================================================================
// BOSS2 ATTACK DATA
// ============================================================================
// All Boss2-specific attack configurations
// Boss2 (Orc Warrior) has two attacks: heavy (attack) and light (attack2)
// ============================================================================

import type { AttackConfig } from '../../../core/config';

export type Boss2AttackId = 
  | 'boss2_heavy'   // Main attack animation
  | 'boss2_light';  // Quick attack (attack2)

/**
 * Boss2 attack configurations
 * Boss is a heavy hitter with slower but more damaging attacks
 */
export const BOSS2_ATTACK_DATA: Record<Boss2AttackId, AttackConfig> = {
  // Heavy attack - slow wind-up, big damage
  boss2_heavy: {
    id: 'boss2_heavy',
    loadout: 'bare',  // Boss uses 'bare' loadout (no weapon switching)
    command: 'heavy',
    damage: 40,       // Slightly more damage than Boss1
    knockback: 200,
    zone: 'center',
    range: 520,       // Slightly longer reach
    durationTicks: 85,
    cooldownTicks: 25,
    specialCharge: 15,
    pressureCharge: 25,
    engageRange: 720,
    superArmor: true,
    telegraph: {
      freezeAtSpineFrame: 23,  // Freeze during wind-up pose
      freezeDurationMs: 300,
    },
  },
  
  // Light attack - quicker poke
  boss2_light: {
    id: 'boss2_light',
    loadout: 'bare',
    command: 'light',
    damage: 18,
    knockback: 50,
    zone: 'center',
    range: 500,
    durationTicks: 55,
    cooldownTicks: 12,
    specialCharge: 8,
    pressureCharge: 12,
    engageRange: 700,
    telegraph: {
      freezeAtSpineFrame: 15,  // Freeze during wind-up pose
      freezeDurationMs: 50,
    },
  },
};
