// ============================================================================
// ANIMATION RESOLVER
// ============================================================================
// Generic animation resolution using character providers
// No character-specific logic - fully delegated to character providers
// ============================================================================

import type { FighterState, Loadout, HitZone } from '../core/types';
import type { AttackId } from '../core/attack-types';
import { getAnimationProvider } from '../characters/provider-registry';
import type { AnimationKey } from '../characters/providers';

export type { AnimationKey };

export interface AnimationContext {
  activeAttack?: AttackId | null;
  blockZone?: HitZone | null;
  attackZone?: HitZone | null;  // For hurt animation
  facingRight?: boolean;
  vx?: number;
  run?: boolean;  // SHIFT modifier for sprint
  pressureStunTicks?: number;  // For pressure stun loop animation
}

/**
 * Resolves animation name for a fighter state
 * Fully generic - delegates to character-specific animation provider
 */
export function resolveAnimation(
  state: FighterState,
  characterId: string,
  loadout: Loadout,
  context: AnimationContext = {}
): AnimationKey {
  const provider = getAnimationProvider(characterId);
  return provider.resolveAnimation(state, loadout, {
    activeAttack: context.activeAttack,
    blockZone: context.blockZone,
    attackZone: context.attackZone,
    facingRight: context.facingRight,
    vx: context.vx,
    run: context.run,
    pressureStunTicks: context.pressureStunTicks
  });
}

/**
 * Get run stop animation (character and loadout specific)
 */
export function getRunStopAnimation(characterId: string, loadout: Loadout): string {
  const provider = getAnimationProvider(characterId);
  return provider.getRunStopAnimation(loadout);
}
