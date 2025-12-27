// ============================================================================
// BOSS2 CHARACTER REGISTRATION
// ============================================================================
// Combines all Boss2 configs and registers with character system
// This is the single entry point for the Boss2 character (Orc Warrior)
// ============================================================================

import { registerCharacter, type CharacterDefinition } from '../registry';
import { registerCharacterProvider } from '../provider-registry';
import type { CharacterProvider } from '../providers';

// Spine configs
import { BOSS2_ASSETS } from './spine/assets';
import { BOSS2_BONE_MAP } from './spine/bone-map';
import { BOSS2_ANIMATIONS } from './spine/animation-map';
import { BOSS2_PROFILE } from './spine/model-profile';

// Combat configs
import { BOSS2_HITBOXES } from './combat/hitboxes';
import { BOSS2_HURTBOXES } from './combat/hurtboxes';

// Providers
import { Boss2AttackResolver, Boss2AnimationProvider } from './providers/boss2-providers';

/**
 * Complete Boss2 character definition
 */
const BOSS2_CHARACTER: CharacterDefinition = {
  id: 'boss2',
  name: 'Orc Warrior',
  
  spine: {
    assets: BOSS2_ASSETS,
    mapping: {
      bones: BOSS2_BONE_MAP,
      animations: BOSS2_ANIMATIONS
    },
    profile: BOSS2_PROFILE
  },
  
  combat: {
    hitboxes: BOSS2_HITBOXES,
    hurtboxes: BOSS2_HURTBOXES
  }
};

/**
 * Boss2 character provider
 */
const BOSS2_PROVIDER: CharacterProvider = {
  id: 'boss2',
  attackResolver: new Boss2AttackResolver(),
  animationProvider: new Boss2AnimationProvider()
};

/**
 * Register the Boss2 character (called from registry initialization)
 */
export function registerBoss2(): void {
  registerCharacter(BOSS2_CHARACTER);
  registerCharacterProvider(BOSS2_PROVIDER);
}

// Export character definition for direct access if needed
export { BOSS2_CHARACTER };
