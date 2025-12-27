// ============================================================================
// BOSS2 CONTEXTUAL ATTACK OVERRIDES
// ============================================================================
// Context-sensitive attack mappings for Boss2
// Boss2 has simple attack patterns - no contextual overrides needed
// ============================================================================

import type { Boss2AttackId } from './attack-data';
import type { Loadout, AttackCommand } from '../../../core/types';

/**
 * Context-sensitive attack overrides for Boss2
 * Key format: "loadout:command:state"
 * Boss2 has no contextual overrides - always uses default attacks
 */
export const BOSS2_CONTEXTUAL_OVERRIDES: Record<string, Boss2AttackId> = {
  // No contextual overrides for Boss2
};

/**
 * Resolve contextual attack for Boss2
 */
export function resolveBoss2ContextualAttack(
  loadout: Loadout,
  command: AttackCommand,
  context?: { state?: string }
): Boss2AttackId | null {
  if (context?.state) {
    const overrideKey = `${loadout}:${command}:${context.state}`;
    const override = BOSS2_CONTEXTUAL_OVERRIDES[overrideKey];
    if (override) return override;
  }
  
  return null; // No contextual override found
}
