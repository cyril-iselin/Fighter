// ============================================================================
// BOSS1 CONTEXTUAL ATTACK OVERRIDES
// ============================================================================
// Context-sensitive attack mappings for Boss1
// Boss1 has simple attack patterns - no contextual overrides needed
// ============================================================================

import type { Boss1AttackId } from './attack-data';
import type { Loadout, AttackCommand } from '../../../core/types';

/**
 * Context-sensitive attack overrides for Boss1
 * Key format: "loadout:command:state"
 * Boss1 has no contextual overrides - always uses default attacks
 */
export const BOSS1_CONTEXTUAL_OVERRIDES: Record<string, Boss1AttackId> = {
  // No contextual overrides for Boss1
  // Could add things like:
  // 'bare:heavy:jump': 'boss1_slam', // If we add more attacks
};

/**
 * Resolve contextual attack for Boss1
 */
export function resolveBoss1ContextualAttack(
  loadout: Loadout,
  command: AttackCommand,
  context?: { state?: string }
): Boss1AttackId | null {
  if (context?.state) {
    const overrideKey = `${loadout}:${command}:${context.state}`;
    const override = BOSS1_CONTEXTUAL_OVERRIDES[overrideKey];
    if (override) return override;
  }
  
  return null; // No contextual override found
}
