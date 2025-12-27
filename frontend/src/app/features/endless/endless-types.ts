// ============================================================================
// ENDLESS MODE TYPES
// ============================================================================

import { Loadout } from '../../core/types';

/**
 * Buff effect types
 */
export type BuffEffectType =
  | 'damage_light'      // +20% light attack damage
  | 'damage_heavy'      // +20% heavy attack damage
  | 'damage_special'    // +20% special attack damage
  | 'block_boost'       // +30% block reduction
  | 'vitality'          // +50 max HP
  | 'special_charge'    // +25% special meter charge
  | 'pressure_master'   // +25% pressure meter build
  | 'parry_window'      // +10% parry window
  | 'greater_vitality'  // +75 max HP
  | 'swift'             // +10% movement speed
  | 'vampirism'         // +4 HP per hit
  | 'counter_strike'    // +15 damage on parry
  | 'sword_mastery'     // Sword loadout (permanent)
  | 'parry_mastery'     // +4 HP per parry
  | 'regeneration'      // +1 HP per second
  | 'first_aid';        // +50% HP restore on victory

/**
 * Buff rarity levels
 */
export type BuffRarity = 'normal' | 'rare' | 'legendary';

/**
 * Single buff definition
 */
export interface BuffDefinition {
  id: BuffEffectType;
  name: string;
  description: string;
  icon: string;
  rarity: BuffRarity;
  value: number;
  stackable: boolean;
}

/**
 * Active buff instance (with stack count)
 */
export interface ActiveBuff {
  id: BuffEffectType;
  stacks: number;
}

/**
 * Computed player modifiers from buffs
 */
export interface PlayerModifiers {
  // Damage multipliers (1.0 = 100%)
  damageLight: number;
  damageHeavy: number;
  damageSpecial: number;
  
  // Defense
  blockReduction: number;      // Additional block reduction (0.3 = 30%)
  parryWindowMultiplier: number; // 1.0 = 100%
  
  // Stats
  maxHealthBonus: number;      // Flat HP bonus
  speedMultiplier: number;     // 1.0 = 100%
  specialChargeMultiplier: number;
  pressureMultiplier: number;
  
  // On-event effects
  hpOnHit: number;             // Flat HP gain per hit
  hpOnParry: number;           // Flat HP gain per parry
  parryCounterDamage: number;  // Bonus damage on parry
  
  // Passive effects
  hpRegenPerSecond: number;    // HP regeneration per second
  victoryHealBonus: number;    // Bonus % HP restore on victory (0.5 = +50%)
  
  // Loadout
  loadout: Loadout;
}

/**
 * Level configuration
 */
export interface EndlessLevelConfig {
  level: number;
  title: string;
  description: string;
  aiId: string;
  bossHealth: number;
  bossDamageMultiplier: number;
}

/**
 * Current run state
 */
export interface EndlessRunState {
  currentLevel: number;
  playerHealth: number;
  playerMaxHealth: number;
  activeBuffs: ActiveBuff[];
  loadout: Loadout;
  totalKills: number;
  totalDamageDealt: number;
}

/**
 * Endless mode phase
 */
export type EndlessPhase = 'intro' | 'fight' | 'buff-select' | 'game-over';

/**
 * Calculate player modifiers from active buffs
 */
export function calculateModifiers(buffs: ActiveBuff[], baseLoadout: Loadout = 'bare'): PlayerModifiers {
  const modifiers: PlayerModifiers = {
    damageLight: 1.0,
    damageHeavy: 1.0,
    damageSpecial: 1.0,
    blockReduction: 0,
    parryWindowMultiplier: 1.0,
    maxHealthBonus: 0,
    speedMultiplier: 1.0,
    specialChargeMultiplier: 1.0,
    pressureMultiplier: 1.0,
    hpOnHit: 0,
    hpOnParry: 0,
    parryCounterDamage: 0,
    hpRegenPerSecond: 0,
    victoryHealBonus: 0,
    loadout: baseLoadout,
  };

  for (const buff of buffs) {
    const stacks = buff.stacks;
    
    switch (buff.id) {
      case 'damage_light':
        modifiers.damageLight += 0.20 * stacks;
        break;
      case 'damage_heavy':
        modifiers.damageHeavy += 0.20 * stacks;
        break;
      case 'damage_special':
        modifiers.damageSpecial += 0.20 * stacks;
        break;
      case 'block_boost':
        modifiers.blockReduction += 0.30 * stacks;
        break;
      case 'vitality':
        modifiers.maxHealthBonus += 50 * stacks;
        break;
      case 'special_charge':
        modifiers.specialChargeMultiplier += 0.25 * stacks;
        break;
      case 'pressure_master':
        modifiers.pressureMultiplier += 0.25 * stacks;
        break;
      case 'parry_window':
        modifiers.parryWindowMultiplier += 0.10 * stacks;
        break;
      case 'greater_vitality':
        modifiers.maxHealthBonus += 75 * stacks;
        break;
      case 'swift':
        modifiers.speedMultiplier += 0.10 * stacks;
        break;
      case 'vampirism':
        modifiers.hpOnHit += 4 * stacks;
        break;
      case 'counter_strike':
        modifiers.parryCounterDamage += 15 * stacks;
        break;
      case 'sword_mastery':
        modifiers.loadout = 'sword';
        break;
      case 'parry_mastery':
        modifiers.hpOnParry += 4 * stacks;
        break;
      case 'regeneration':
        modifiers.hpRegenPerSecond += 1 * stacks;
        break;
      case 'first_aid':
        modifiers.victoryHealBonus += 0.5 * stacks;
        break;
    }
  }

  return modifiers;
}
