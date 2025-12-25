// ============================================
// Attack Data - Data-Driven Attack Configuration
// ============================================
// Instead of parsing animation names to determine hitbox type,
// we define each attack's properties here.
// ============================================

import { BareAttack, SwordAttack, HitZone, Loadout } from './types';

// ============================================
// Hitbox Source - which bone/attachment to use
// ============================================

export type HitboxSource = 
  | 'rightHand'    // Punches, bare attacks
  | 'leftHand'     // Some combo attacks
  | 'rightFoot'    // Kicks
  | 'leftFoot'     // Some kick variants
  | 'weapon';      // Sword slash (uses weapon line)

// ============================================
// Attack Configuration
// ============================================

export interface AttackConfig {
  /** Unique attack identifier */
  id: string;
  
  /** Which bone/attachment provides the hitbox */
  hitboxSource: HitboxSource;
  
  /** Does this attack use a line hitbox (weapon) instead of point? */
  usesLineHitbox: boolean;
  
  /** Base damage for this attack */
  baseDamage: number;
  
  /** Which zone this attack targets (for blocking) */
  targetZone: HitZone;
  
  /** Hitbox radius in pixels */
  hitboxRadius: number;
  
  /** Optional: damage multiplier for headshots */
  headshotMultiplier?: number;
  
  /** Optional: knockback force */
  knockback?: number;
  
  /** Optional: hitstun duration in seconds */
  hitstun?: number;
  
  /** Optional: whether this attack can hit multiple times */
  multiHit?: boolean;
  
  /** Optional: interval between hits in milliseconds (for multi-hit attacks) */
  hitIntervalMs?: number;
  
  /** 
   * How much this attack adds to the special meter (0-100).
   * Only applies when the player lands a hit.
   */
  specialCharge?: number;

  /** 
   * Duration in milliseconds that the attack hitbox is active.
   * After this time, the hitbox is deactivated (recovery animation can't hit).
   * Default is 250ms for most attacks.
   */
  attackDurationMs?: number;

  /**
   * Charge-up time in milliseconds before the attack executes.
   * During this time, the fighter pauses at wind-up position.
   * This applies to ALL fighters (player + AI), not just AI telegraph.
   * For sword heavy attack: player has this charge-up, AI adds telegraph time on top.
   */
  chargeUpMs?: number;

  /**
   * Optional: Animation to play during charge-up phase.
   * If not specified, uses the attack animation itself (paused at wind-up).
   * For uppercut: uses jab_single (fist pulled back)
   */
  chargeAnimation?: string;
}

// ============================================
// Bare-Handed Attack Configurations
// ============================================

const BARE_ATTACKS: Record<BareAttack, AttackConfig> = {
  // Jabs - fast hand attacks
  jab_single: {
    id: 'jab_single',
    hitboxSource: 'rightHand',
    usesLineHitbox: false,
    baseDamage: 5,
    targetZone: 'center',
    hitboxRadius: 40,
    hitstun: 0.2,
    specialCharge: 5
  },
  jab_double: {
    id: 'jab_double',
    hitboxSource: 'rightHand',
    usesLineHitbox: false,
    baseDamage: 8,
    targetZone: 'center',
    hitboxRadius: 40,
    hitstun: 0.25,
    specialCharge: 8
  },
  jab_high_single: {
    id: 'jab_high_single',
    hitboxSource: 'rightHand',
    usesLineHitbox: false,
    baseDamage: 6,
    targetZone: 'top',
    hitboxRadius: 40,
    headshotMultiplier: 1.5,
    hitstun: 0.2,
    specialCharge: 6
  },
  jab_high_double: {
    id: 'jab_high_double',
    hitboxSource: 'rightHand',
    usesLineHitbox: false,
    baseDamage: 10,
    targetZone: 'top',
    hitboxRadius: 40,
    headshotMultiplier: 1.5,
    hitstun: 0.3,
    specialCharge: 10
  },
  
  // Kicks - foot attacks
  kick_high: {
    id: 'kick_high',
    hitboxSource: 'rightFoot',
    usesLineHitbox: false,
    baseDamage: 12,
    targetZone: 'top',
    hitboxRadius: 45,
    headshotMultiplier: 1.5,
    knockback: 50,
    hitstun: 0.3,
    specialCharge: 12
  },
  kick_low: {
    id: 'kick_low',
    hitboxSource: 'rightFoot',
    usesLineHitbox: false,
    baseDamage: 8,
    targetZone: 'bottom',
    hitboxRadius: 45,
    hitstun: 0.25,
    specialCharge: 8
  },
  kick_straight: {
    id: 'kick_straight',
    hitboxSource: 'rightFoot',
    usesLineHitbox: false,
    baseDamage: 10,
    targetZone: 'center',
    hitboxRadius: 50,
    knockback: 80,
    hitstun: 0.3,
    specialCharge: 10
  },
  
  // Special attacks
  uppercut: {
    id: 'uppercut',
    hitboxSource: 'rightHand',
    usesLineHitbox: false,
    baseDamage: 15,
    targetZone: 'top',
    hitboxRadius: 45,
    headshotMultiplier: 2.0,
    knockback: 100,
    hitstun: 0.4,
    specialCharge: 15,
    chargeUpMs: 300,  // 300ms charge-up
    chargeAnimation: 'jab_high_single' // Wind-up pose
  },
  flying_kick: {
    id: 'flying_kick',
    hitboxSource: 'rightFoot',
    usesLineHitbox: false,
    baseDamage: 18,
    targetZone: 'center',
    hitboxRadius: 45,
    knockback: 120,
    hitstun: 0.5,
    specialCharge: 18
  },
  salto_kick: {
    id: 'salto_kick',
    hitboxSource: 'rightFoot',
    usesLineHitbox: false,
    baseDamage: 20,
    targetZone: 'top',
    hitboxRadius: 45,
    headshotMultiplier: 1.5,
    knockback: 150,
    hitstun: 0.6,
    specialCharge: 20
  },
  thousand_fists: {
    id: 'thousand_fists',
    hitboxSource: 'rightHand',
    usesLineHitbox: false,
    baseDamage: 12, // Per hit, many hits
    targetZone: 'center',
    hitboxRadius: 45,
    hitstun: 0.1,
    multiHit: true,
    hitIntervalMs: 100, // Hit every 100ms
    specialCharge: 0  // Special attack doesn't charge more special
  },
  reverse_kick: {
    id: 'reverse_kick',
    hitboxSource: 'rightFoot',
    usesLineHitbox: false,
    baseDamage: 14,
    targetZone: 'center',
    hitboxRadius: 45,
    knockback: 100,
    hitstun: 0.4,
    specialCharge: 14
  }
};

// ============================================
// Sword Attack Configurations
// ============================================

const SWORD_ATTACKS: Record<SwordAttack, AttackConfig> = {
  slash_light: {
    id: 'slash_light',
    hitboxSource: 'weapon',
    usesLineHitbox: true,  // Weapon uses line collision
    baseDamage: 20,
    targetZone: 'center',
    hitboxRadius: 50,  // Line thickness - increased to prevent tunneling
    knockback: 60,
    hitstun: 0.05,
    attackDurationMs: 300,  // Hitbox active for 300ms (swing portion only)
    specialCharge: 0  // Sword doesn't charge special meter
  },
  slash_heavy: {
    id: 'slash_heavy',
    hitboxSource: 'weapon',
    usesLineHitbox: true,  // Weapon uses line collision
    baseDamage: 35,  // More damage than light
    targetZone: 'center',
    hitboxRadius: 50,  // Line thickness - increased to prevent tunneling
    knockback: 120,  // Strong knockback
    hitstun: 0.4,
    attackDurationMs: 350,  // Slightly longer active window
    specialCharge: 0,  // Sword doesn't charge special meter
    chargeUpMs: 400  // 400ms charge-up for ALL players (AI adds telegraph on top)
  }
};

// ============================================
// Attack Registry - All attacks by ID
// ============================================

export type AttackId = BareAttack | SwordAttack;

const ALL_ATTACKS: Record<AttackId, AttackConfig> = {
  ...BARE_ATTACKS,
  ...SWORD_ATTACKS
};

// ============================================
// Public API
// ============================================

/**
 * Get attack configuration by ID
 */
export function getAttackConfig(attackId: AttackId): AttackConfig | undefined {
  return ALL_ATTACKS[attackId];
}

/**
 * Get all attack configs for a loadout
 */
export function getAttacksForLoadout(loadout: Loadout): Record<string, AttackConfig> {
  if (loadout === 'sword') {
    return { ...BARE_ATTACKS, ...SWORD_ATTACKS };
  }
  return { ...BARE_ATTACKS };
}

/**
 * Check if an attack uses weapon line hitbox
 */
export function usesWeaponHitbox(attackId: AttackId): boolean {
  const config = ALL_ATTACKS[attackId];
  return config?.hitboxSource === 'weapon' && config?.usesLineHitbox === true;
}

/**
 * Get the hitbox source for an attack
 */
export function getHitboxSource(attackId: AttackId): HitboxSource | undefined {
  return ALL_ATTACKS[attackId]?.hitboxSource;
}
