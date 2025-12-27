// ============================================================================
// CHARACTER AI PROFILE TYPES
// ============================================================================
// Interfaces for character-specific AI configuration
// Allows customization without code duplication
// ============================================================================

import type { AttackCommand, HitZone, FighterState } from '../../core/types';

// ============================================================================
// ATTACK POLICY
// ============================================================================

/**
 * Weighted attack choice with optional conditions
 * Note: Distance constraints come from attack-data.ts (engageRange per attack)
 */
export interface AttackWeight {
  /** Attack command to execute */
  readonly command: AttackCommand;
  
  /** Base weight for selection (higher = more likely) */
  readonly weight: number;
  
  /** Optional: Only valid when opponent is in specific state */
  readonly opponentStates?: readonly FighterState[];
  
  /** Optional: Cooldown in ticks before this attack can be chosen again */
  readonly cooldownTicks?: number;
}

/**
 * Attack selection policy for a character
 */
export interface AttackPolicy {
  /** Default attack weights when in engage range */
  readonly attacks: readonly AttackWeight[];
  
  /** Optional: Special attack weights when opponent is telegraphing */
  readonly telegraphAttacks?: readonly AttackWeight[];
  
  /** Optional: Special attack weights for wake-up pressure */
  readonly pressureAttacks?: readonly AttackWeight[];
}

// ============================================================================
// RANGE POLICY
// ============================================================================

/**
 * Range configuration for AI spacing
 * 
 * Zones (from closest to furthest):
 * |<-- RETREAT -->|<-- OPTIMAL -->|<-- APPROACH -->|
 * 0     retreat    preferred       engage          ∞
 * 
 * Note: engageRange is auto-computed from attack-data if not provided
 */
export interface RangePolicy {
  /** 
   * Distance at which AI will attack (optional)
   * If not set, computed as max(engageRange) from all attacks for current loadout
   */
  readonly engageRange?: number;
  
  /** Hysteresis buffer to prevent flicker (added to engageRange for exit) */
  readonly engageHysteresis: number;
  
  /** Distance below which AI stops chasing (deadzone) */
  readonly chaseDeadzone: number;
  
  /** Ticks to lock chase direction (prevents direction flicker) */
  readonly chaseLockTicks: number;
  
  /** Distance at which AI will stop chasing airborne opponents */
  readonly airborneStopRange: number;
  
  // --- SPACING ---
  
  /** 
   * Preferred fighting distance - AI will try to maintain this range
   * If not set, AI won't actively maintain distance
   */
  readonly preferredDistance?: number;
  
  /** 
   * Distance below which AI considers retreating (too close)
   * If not set, AI will never retreat
   */
  readonly retreatDistance?: number;
  
  /**
   * Probability (0-1) to retreat when inside retreatDistance
   * Default: 0.5
   */
  readonly retreatProbability?: number;
  
  /**
   * If true, AI will actively try to stay at preferredDistance
   * (moves back if too close, forward if too far)
   * Default: false
   */
  readonly maintainDistance?: boolean;
  
  /**
   * Ticks to lock retreat direction (prevents retreat flicker)
   * Default: same as chaseLockTicks
   */
  readonly retreatLockTicks?: number;
}

// ============================================================================
// DEFENSE POLICY
// ============================================================================

/**
 * Block zone selection for incoming attacks
 */
export interface BlockMapping {
  /** Attack zone → block zone mapping */
  readonly zoneMap: Readonly<Record<HitZone, HitZone>>;
  
  /** Default block zone if attack zone unknown */
  readonly defaultZone: HitZone;
}

/**
 * Defense configuration for AI
 */
export interface DefensePolicy {
  /** How to map incoming attacks to block zones */
  readonly blockMapping: BlockMapping;
  
  /** Buffer distance added to attack range for block decision */
  readonly blockRangeBuffer: number;
  
  /** Probability to attempt parry instead of block (0-1) */
  readonly parryChance: number;
  
  /** States in which opponent is considered attacking */
  readonly attackingStates: readonly FighterState[];
}

// ============================================================================
// BEHAVIOR MODIFIERS
// ============================================================================

/**
 * Aggression and timing modifiers
 */
export interface BehaviorModifiers {
  /** Base aggression level (0-1, affects attack frequency) */
  readonly aggression: number;
  
  /** Reaction delay in ticks (higher = slower reactions) */
  readonly reactionDelay: number;
  
  /** Probability to pursue knocked down opponent */
  readonly pressureChance: number;
  
  /** Probability to retreat at low health */
  readonly survivalInstinct: number;
}

// ============================================================================
// PHASE SYSTEM (Boss Fights)
// ============================================================================

/**
 * Attack weight override for a phase
 */
export interface PhaseAttackWeights {
  readonly heavy?: number;
  readonly light?: number;
  readonly special?: number;
}

/**
 * A single phase configuration
 * All properties except hpPercent are optional overrides
 */
export interface BossPhase {
  /** HP percentage threshold to enter this phase (100 = start, lower = later phases) */
  readonly hpPercent: number;
  
  /** Display name for this phase (shown in combat text) */
  readonly name?: string;
  
  /** Speed multiplier (1.0 = normal, 1.5 = 50% faster) */
  readonly speed?: number;
  
  /** Aggression override (0-1) */
  readonly aggression?: number;
  
  /** Attack weight overrides */
  readonly attackWeights?: PhaseAttackWeights;
  
  /** Reaction delay override in ticks */
  readonly reactionDelay?: number;
  
  /** Preferred fighting distance override */
  readonly preferredDistance?: number;
  
  /** Enable super armor during attacks */
  readonly superArmor?: boolean;
  
  /** Rage burst configuration (proximity-based knockback) */
  readonly rageBurst?: {
    /** Distance threshold - player must be closer than this (pixels) */
    proximityThreshold?: number;
    /** Ticks player must stay in proximity to trigger burst */
    durationTicks?: number;
    /** Cooldown before another burst can trigger (ticks) */
    cooldownTicks?: number;
    /** Knockback force applied to player */
    knockbackStrength?: number;
  };
  
  /** Telegraph duration overrides per attack (freezeDurationMs) */
  readonly telegraphOverrides?: Record<string, number>;
  
  /** Loadout override for this phase ('bare' | 'sword') */
  readonly loadout?: 'bare' | 'sword';
}

// ============================================================================
// CHARACTER AI PROFILE (Main Interface)
// ============================================================================

/**
 * Complete AI profile for a character
 * Defines all behavior without containing logic
 */
export interface CharacterAIProfile {
  /** Character ID this profile belongs to */
  readonly characterId: string;
  
  /** Display name for debugging */
  readonly name: string;
  
  /** Attack selection configuration */
  readonly attackPolicy: AttackPolicy;
  
  /** Range and spacing configuration */
  readonly rangePolicy: RangePolicy;
  
  /** Defense and blocking configuration */
  readonly defensePolicy: DefensePolicy;
  
  /** Behavior modifiers */
  readonly behavior: BehaviorModifiers;
  
  /** Optional: Phase-based behavior changes (boss fights) */
  readonly phases?: readonly BossPhase[];
}

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Default range policy values
 * Note: engageRange is computed from attack-data, not a default
 */
export const DEFAULT_RANGE_POLICY: Omit<RangePolicy, 'engageRange'> & { engageRange?: number } = {
  engageHysteresis: 25,
  chaseDeadzone: 12,
  chaseLockTicks: 6,
  airborneStopRange: 100,
};

/**
 * Default defense policy values
 */
export const DEFAULT_DEFENSE_POLICY: DefensePolicy = {
  blockMapping: {
    zoneMap: {
      top: 'top',
      center: 'center',
    },
    defaultZone: 'center',
  },
  blockRangeBuffer: 20,
  parryChance: 0.30,
  attackingStates: ['telegraph', 'attack'],
};

/**
 * Default behavior modifiers
 */
export const DEFAULT_BEHAVIOR: BehaviorModifiers = {
  aggression: 0.5,
  reactionDelay: 0,
  pressureChance: 0.3,
  survivalInstinct: 0.2,
};

/**
 * Helper to create a profile with defaults
 */
export function createProfile(
  partial: Partial<CharacterAIProfile> & Pick<CharacterAIProfile, 'characterId' | 'name' | 'attackPolicy'>
): CharacterAIProfile {
  return {
    characterId: partial.characterId,
    name: partial.name,
    attackPolicy: partial.attackPolicy,
    rangePolicy: { ...DEFAULT_RANGE_POLICY, ...partial.rangePolicy },
    defensePolicy: { ...DEFAULT_DEFENSE_POLICY, ...partial.defensePolicy },
    behavior: { ...DEFAULT_BEHAVIOR, ...partial.behavior },
    phases: partial.phases,  // Pass through phases for boss fights
  };
}
