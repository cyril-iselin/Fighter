// ============================================================================
// AI BRAIN FACTORY
// ============================================================================
// Factory for creating AI brains from character profiles
// Centralizes brain instantiation and profile management
// ============================================================================

import type { IFighterBrain } from './brain.interface';
import type { CharacterAIProfile } from './profiles/types';
import { GenericBasicBrain } from './profiles/generic-basic-brain';
import { DebugBrain } from './debug-brain';
import { SeededRNG, type IRNG } from './rng';

// Profile registry
const profiles = new Map<string, CharacterAIProfile>();

// ============================================================================
// PROFILE REGISTRATION
// ============================================================================

/**
 * Register an AI profile for a character
 */
export function registerAIProfile(profile: CharacterAIProfile): void {
  profiles.set(profile.characterId, profile);
  console.log(`[AIFactory] Registered AI profile for: ${profile.name}`);
}

/**
 * Get AI profile for a character
 */
export function getAIProfile(characterId: string): CharacterAIProfile | undefined {
  return profiles.get(characterId);
}

/**
 * Check if AI profile exists for character
 */
export function hasAIProfile(characterId: string): boolean {
  return profiles.has(characterId);
}

/**
 * Get all registered profile character IDs
 */
export function getRegisteredProfiles(): string[] {
  return Array.from(profiles.keys());
}

// ============================================================================
// BRAIN FACTORY
// ============================================================================

export interface BrainFactoryOptions {
  /** Seed for deterministic RNG */
  seed?: number;
  /** Enable debug wrapper */
  debug?: boolean;
  /** Debug log interval (ticks) */
  debugLogInterval?: number;
  /** Custom RNG instance */
  rng?: IRNG;
}

/**
 * Create an AI brain for a character
 * @param characterId Character ID to create brain for
 * @param options Factory options
 * @returns Configured brain instance
 * @throws Error if no profile registered for character
 */
export function createBrain(
  characterId: string,
  options: BrainFactoryOptions = {}
): IFighterBrain {
  const profile = profiles.get(characterId);
  
  if (!profile) {
    throw new Error(
      `[AIFactory] No AI profile registered for character: ${characterId}. ` +
      `Registered profiles: [${getRegisteredProfiles().join(', ')}]`
    );
  }

  // Create RNG
  const rng = options.rng ?? new SeededRNG(options.seed ?? 12345);

  // Create base brain
  let brain: IFighterBrain = new GenericBasicBrain(characterId, profile, rng);

  // Wrap with debug if requested
  if (options.debug) {
    brain = new DebugBrain(brain, {
      logInterval: options.debugLogInterval ?? 60,
      prefix: `[AI:${characterId}]`,
    });
  }

  return brain;
}

/**
 * Create a brain with custom profile (for testing or overrides)
 */
export function createBrainWithProfile(
  profile: CharacterAIProfile,
  options: BrainFactoryOptions = {}
): IFighterBrain {
  const rng = options.rng ?? new SeededRNG(options.seed ?? 12345);
  let brain: IFighterBrain = new GenericBasicBrain(profile.characterId, profile, rng);

  if (options.debug) {
    brain = new DebugBrain(brain, {
      logInterval: options.debugLogInterval ?? 60,
      prefix: `[AI:${profile.characterId}]`,
    });
  }

  return brain;
}

// ============================================================================
// CONVENIENCE HELPERS
// ============================================================================

/**
 * Create brain for player 2 (AI opponent)
 * Uses different seed for variety
 */
export function createOpponentBrain(
  characterId: string,
  debug = false
): IFighterBrain {
  return createBrain(characterId, {
    seed: 54321, // Different seed for opponent
    debug,
  });
}

/**
 * Create matched pair of brains for testing
 */
export function createBrainPair(
  characterId1: string,
  characterId2: string,
  debug = false
): [IFighterBrain, IFighterBrain] {
  return [
    createBrain(characterId1, { seed: 11111, debug }),
    createBrain(characterId2, { seed: 22222, debug }),
  ];
}
