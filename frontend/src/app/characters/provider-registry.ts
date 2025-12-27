// ============================================================================
// CHARACTER PROVIDER REGISTRY
// ============================================================================
// Central registry for character providers
// Clean provider-based access to character-specific functionality
// ============================================================================

import type { CharacterProvider, AttackResolver, AnimationProvider } from './providers';

// Registry storage
const providers = new Map<string, CharacterProvider>();

/**
 * Register character provider
 */
export function registerCharacterProvider(provider: CharacterProvider): void {
  providers.set(provider.id, provider);
  console.log(`[CharacterProviders] Registered provider for character: ${provider.id}`);
}

/**
 * Get attack resolver for character
 */
export function getAttackResolver(characterId: string): AttackResolver {
  const provider = providers.get(characterId);
  if (!provider) {
    throw new Error(`[CharacterProviders] No provider registered for character: ${characterId}`);
  }
  return provider.attackResolver;
}

/**
 * Get animation provider for character
 */
export function getAnimationProvider(characterId: string): AnimationProvider {
  const provider = providers.get(characterId);
  if (!provider) {
    throw new Error(`[CharacterProviders] No provider registered for character: ${characterId}`);
  }
  return provider.animationProvider;
}

/**
 * Check if character provider is registered
 */
export function hasCharacterProvider(characterId: string): boolean {
  return providers.has(characterId);
}

/**
 * Get all registered character IDs
 */
export function getRegisteredCharacters(): string[] {
  return Array.from(providers.keys());
}

// CONVENIENCE FUNCTIONS for cleaner API

/**
 * Resolve contextual attack for character
 */
export function resolveContextualAttack(
  characterId: string,
  loadout: any,
  command: any,
  context?: { state?: string }
): string | null {
  return getAttackResolver(characterId).resolveContextualAttack(loadout, command, context);
}

/**
 * Get attack data for character
 */
export function getCharacterAttackData(characterId: string, attackId: string): any | null {
  return getAttackResolver(characterId).getAttackData(attackId);
}

/**
 * Get all attack configs for a character and loadout
 * Returns array of AttackConfig objects with engageRange
 */
export function getAttacksForLoadout(characterId: string, loadout: any): any[] {
  const resolver = getAttackResolver(characterId);
  const attackIds = resolver.getAttacksForLoadout(loadout);
  return attackIds
    .map(id => resolver.getAttackData(id))
    .filter((data): data is NonNullable<typeof data> => data !== null);
}