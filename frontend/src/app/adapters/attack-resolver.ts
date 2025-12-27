// ============================================================================
// GENERIC ATTACK RESOLVER 
// ============================================================================
// Character-agnostic attack resolution using character providers
// ============================================================================

import type { Loadout, AttackCommand } from '../core/types';
import { getAttackResolver } from '../characters/provider-registry';

/**
 * Resolve attack using character-specific attack resolver
 */
export function resolveAttack(
  characterId: string,
  loadout: Loadout,
  command: AttackCommand,
  context?: { state?: string }
): string | null {
  const resolver = getAttackResolver(characterId);
  
  // Check character-specific contextual overrides first
  const contextualAttack = resolver.resolveContextualAttack(loadout, command, context);
  if (contextualAttack) return contextualAttack;

  // Fallback: Find matching attack by loadout + command
  const allAttacks = resolver.getAttacksForLoadout(loadout);
  for (const attackId of allAttacks) {
    const attackData = resolver.getAttackData(attackId);
    if (attackData && attackData.command === command) {
      return attackId; // Return first attack matching loadout + command
    }
  }

  return null; // No matching attack found
}

/**
 * Get attack data for a specific character and attack ID
 */
export function getAttackData(characterId: string, attackId: string): any | null {
  const resolver = getAttackResolver(characterId);
  return resolver.getAttackData(attackId);
}