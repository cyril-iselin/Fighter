// ============================================================================
// BOSS3 ATTACK DATA
// ============================================================================
// All Boss3-specific attack configurations
// Boss3 (The Bear) has two attacks: heavy (attack) and light (attack2)
// ============================================================================

import type { AttackConfig } from '../../../core/config';

export type Boss3AttackId = 
  | 'boss3_heavy'   // Main attack animation
  | 'boss3_light';  // Quick attack (attack2)

/**
 * Boss3 attack configurations
 * The Bear is a slow but devastating brawler
 */
export const BOSS3_ATTACK_DATA: Record<Boss3AttackId, AttackConfig> = {
  // Heavy attack - massive damage, very slow
  boss3_heavy: {
    id: 'boss3_heavy',
    loadout: 'bare',
    command: 'heavy',
    damage: 50,       // Highest damage of all bosses
    knockback: 200,   // Huge knockback
    zone: 'center',
    range: 480,       
    durationTicks: 110, // Very slow wind-up
    cooldownTicks: 45,
    specialCharge: 10,
    pressureCharge: 30,
    engageRange: 550,
    superArmor: true,
    telegraph: {
      freezeAtSpineFrame: 26,  // Longer freeze for bigger wind-up
      freezeDurationMs: 400,
    },
  },
  
  // Light attack - still slow but less punishable
  boss3_light: {
    id: 'boss3_light',
    loadout: 'bare',
    command: 'light',
    damage: 22,
    knockback: 60,
    zone: 'center',
    range: 480,
    durationTicks: 65,
    cooldownTicks: 15,
    specialCharge: 10,
    pressureCharge: 15,
    engageRange: 550,
  },
};
