// ============================================================================
// CHARACTER PROVIDERS
// ============================================================================
// Provider interfaces for character-specific functionality
// Clean separation between core game logic and character implementations
// ============================================================================

import type { Loadout, AttackCommand, FighterState, HitZone } from '../core/types';

/**
 * Animation key with name and loop flag
 */
export interface AnimationKey {
  name: string;
  loop: boolean;
}

/**
 * Character-specific animation resolution
 */
export interface AnimationProvider {
  /**
   * Resolve animation for a given state and loadout
   */
  resolveAnimation(
    state: FighterState,
    loadout: string,
    context: {
      activeAttack?: string | null;
      blockZone?: HitZone | null;
      attackZone?: HitZone | null;
      facingRight?: boolean;
      vx?: number;
      run?: boolean;
      pressureStunTicks?: number;
    }
  ): AnimationKey;

  /**
   * Get run stop animation for a loadout
   */
  getRunStopAnimation(loadout: string): string;
}

/**
 * Character-specific attack resolution
 */
export interface AttackResolver {
  /**
   * Resolve contextual attack (e.g. jump attacks, running attacks)
   */
  resolveContextualAttack(
    loadout: Loadout,
    command: AttackCommand,
    context?: { state?: string }
  ): string | null;

  /**
   * Get attack data for this character
   */
  getAttackData(attackId: string): any | null;

  /**
   * Get all available attacks for a loadout
   */
  getAttacksForLoadout(loadout: any): string[];
}

/**
 * Combined character provider interface
 */
export interface CharacterProvider {
  readonly id: string;
  readonly attackResolver: AttackResolver;
  readonly animationProvider: AnimationProvider;
}