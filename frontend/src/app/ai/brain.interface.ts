import type { Intent, Observation } from '../core/types';

// ============================================================================
// FIGHTER BRAIN INTERFACE
// ============================================================================

/**
 * AI Brain Interface
 * Observes match state and produces Intent
 * Must be pure (no side effects, no direct Core/Adapter access)
 */
export interface IFighterBrain {
  /**
   * Decides next action based on observation
   * Called once per tick
   * @param obs - Current observation from fighter's perspective
   * @param tick - Current game tick (for deterministic behavior)
   * @returns Intent for this fighter
   */
  decide(obs: Observation, tick: number): Intent;
  
  /**
   * Optional: Get current speed multiplier (for phase system)
   * Called after decide() to get movement speed modifier
   * @returns Speed multiplier (1.0 = normal speed)
   */
  getSpeedMultiplier?(): number;
  
  /**
   * Optional: Check if super armor is active (for phase system)
   * Called after decide() to enable phase-based super armor
   * @returns true if all attacks should have super armor
   */
  hasSuperArmor?(): boolean;
  
  /**
   * Optional: Get telegraph duration overrides (for phase system)
   * Called after decide() to apply phase-specific telegraph timings
   * @returns Map of attackId → freezeDurationMs overrides
   */
  getTelegraphOverrides?(): Record<string, number> | undefined;
  
  /**
   * Optional: Get rage burst configuration (for phase system)
   * Called each tick to check proximity-based rage burst
   * @returns Partial config to override defaults, or undefined for no rage burst
   */
  getRageBurstConfig?(): { proximityThreshold?: number; durationTicks?: number; cooldownTicks?: number; knockbackStrength?: number } | undefined;
  
  /**
   * Optional: Consume pending phase change event (for phase system)
   * Called after decide() to get phase transition notification
   * Returns event data once per phase change, then null until next change
   * @returns Phase change event data or null
   */
  consumePhaseChange?(): { phaseName: string; hpPercent: number } | null;
  
  /**
   * Optional: Get loadout override (for phase system)
   * Called after decide() to apply phase-specific loadout
   * @returns Loadout to use, or undefined to keep current
   */
  getLoadoutOverride?(): 'bare' | 'sword' | undefined;
}

/**
 * Optional interface for brains that need initialization
 */
export interface IConfigurableBrain extends IFighterBrain {
  /**
   * Called once when brain is attached to fighter
   * @param fighterId - 0 or 1
   */
  initialize?(fighterId: 0 | 1): void;
}
