// ============================================================================
// STICKMAN CONTEXTUAL ATTACK OVERRIDES
// ============================================================================
// Context-sensitive attack mappings for stickman
// ============================================================================

import type { StickmanAttackId } from './attack-data';
import type { Loadout, AttackCommand } from '../../../core/types';

/**
 * Context-sensitive attack overrides for stickman
 * Key format: "loadout:command:state"
 */
export const STICKMAN_CONTEXTUAL_OVERRIDES: Record<string, StickmanAttackId> = {
  'bare:light:jump': 'flying_kick',
  'bare:heavy:jump': 'salto_kick',
  'bare:light:move': 'reverse_kick',  // Reverse kick while running
  // Future contextual mappings:
  // 'bare:heavy:crouch': 'uppercut',
  // 'sword:light:dash': 'thrust',
  // etc.
};

/**
 * Resolve contextual attack for stickman
 */
export function resolveStickmanContextualAttack(
  loadout: Loadout,
  command: AttackCommand,
  context?: { state?: string }
): StickmanAttackId | null {
  if (context?.state) {
    const overrideKey = `${loadout}:${command}:${context.state}`;
    const override = STICKMAN_CONTEXTUAL_OVERRIDES[overrideKey];
    if (override) return override;
  }
  
  return null; // No contextual override found
}