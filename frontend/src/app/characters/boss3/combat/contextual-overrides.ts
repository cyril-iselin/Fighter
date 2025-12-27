// ============================================================================
// BOSS3 CONTEXTUAL ATTACK OVERRIDES
// ============================================================================
// Context-sensitive attack mappings for Boss3
// Boss3 has simple attack patterns - no contextual overrides needed
// ============================================================================

import type { Boss3AttackId } from './attack-data';
import type { Loadout, AttackCommand } from '../../../core/types';

/**
 * Context-sensitive attack overrides for Boss3
 * Key format: "loadout:command:state"
 * Boss3 has no contextual overrides - always uses default attacks
 */
export const BOSS3_CONTEXTUAL_OVERRIDES: Record<string, Boss3AttackId> = {
  // No contextual overrides for Boss3
};

/**
 * Resolve contextual attack for Boss3
 */
export function resolveBoss3ContextualAttack(
  loadout: Loadout,
  command: AttackCommand,
  context?: { state?: string }
): Boss3AttackId | null {
  if (context?.state) {
    const overrideKey = `${loadout}:${command}:${context.state}`;
    const override = BOSS3_CONTEXTUAL_OVERRIDES[overrideKey];
    if (override) return override;
  }
  
  return null; // No contextual override found
}
