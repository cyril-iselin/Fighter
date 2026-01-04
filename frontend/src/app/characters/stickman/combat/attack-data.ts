// ============================================================================
// STICKMAN ATTACK DATA
// ============================================================================
// All stickman-specific attack configurations
// ============================================================================

import type { AttackConfig } from '../../../core/config';

export type StickmanAttackId = 
  // Bare
  | 'jab_double' 
  | 'kick_high' 
  | 'flying_kick'
  | 'salto_kick' 
  | 'thousand_fists' 
  | 'reverse_kick'
  // Sword
  | 'slash' 
  | 'slash_heavy';

/**
 * Stickman attack configurations
 * Moved from core/config.ts for character-specific isolation
 */
export const STICKMAN_ATTACK_DATA: Record<StickmanAttackId, AttackConfig> = {
  // --- BARE ATTACKS ---
  // Note: engageRange should be ~1.5x of range to account for character width
  // Characters overlap visually at ~100px distance
  jab_double: {
    id: 'jab_double',
    loadout: 'bare', 
    command: 'light',
    damage: 8,
    knockback: 30,
    zone: 'center',
    range: 120,
    durationTicks: 30,
    specialCharge: 7,
    pressureCharge: 8,
    engageRange: 300,    // Was 150 - AI starts further back
    cooldownTicks: 10,
  },
  kick_high: {
    id: 'kick_high',
    loadout: 'bare',
    command: 'heavy',
    damage: 12,
    knockback: 50,
    zone: 'top',
    range: 140,
    durationTicks: 30,
    cooldownTicks: 10,
    specialCharge: 10,
    pressureCharge: 9,
    engageRange: 350,    // Was 170
    superArmor: true,
  },
  flying_kick: {
    id: 'flying_kick',
    loadout: 'bare',
    command: 'heavy',
    damage: 18,
    knockback: 120,
    zone: 'center',
    range: 160,
    durationTicks: 20,
    cooldownTicks: 35,
    specialCharge: 18,
    pressureCharge: 15,
    engageRange: 300,    // Was 170 - flying kick has more range
    superArmor: true,
  },
  salto_kick: {
    id: 'salto_kick',
    loadout: 'bare',
    command: 'heavy',
    damage: 20,
    knockback: 150,
    zone: 'top',
    range: 160,
    durationTicks: 35,
    cooldownTicks: 35,
    specialCharge: 15,
    pressureCharge: 15,
    engageRange: 300,    // Was 190
    superArmor: true,
  },
  thousand_fists: {
    id: 'thousand_fists',
    loadout: 'bare',
    command: 'special',
    damage: 15,
    knockback: 0,
    zone: 'center',
    range: 120,
    durationTicks: 60,
    cooldownTicks: 60,
    multiHit: true,
    hitInterval: 10,
    specialCharge: 0,
    pressureCharge: 5,
    engageRange: 180,
    superArmor: true,
  },
  reverse_kick: {
    id: 'reverse_kick',
    loadout: 'bare',
    command: 'light',
    damage: 14,
    knockback: 40,
    zone: 'center',
    range: 140,
    durationTicks: 30,
    cooldownTicks: 30,
    specialCharge: 7,
    pressureCharge: 7,
    engageRange: 250,    // Was 150
  },

  // --- SWORD ATTACKS ---
  // Sword has longer reach, so engageRange is higher
  slash: {
    id: 'slash',
    loadout: 'sword',
    command: 'light',
    damage: 20,
    knockback: 60,
    zone: 'center',
    range: 180,
    durationTicks: 30,
    cooldownTicks: 20,
    specialCharge: 5,
    pressureCharge: 12,
    engageRange: 450,    // Was 220 - sword keeps more distance
  },
  slash_heavy: {
    id: 'slash_heavy',
    loadout: 'sword',
    command: 'heavy',
    damage: 35,
    knockback: 120,
    zone: 'center',
    range: 180,
    cooldownTicks: 0,
    durationTicks: 30,
    telegraph: {
      freezeAtSpineFrame: 6,  // Freeze after 5 frames of wind-up
      freezeDurationMs: 500,
    },
    specialCharge: 10,
    pressureCharge: 20,
    engageRange: 450,    // Was 220
    superArmor: true,
  },
};