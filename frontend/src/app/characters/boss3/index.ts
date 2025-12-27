// ============================================================================
// BOSS3 CHARACTER REGISTRATION
// ============================================================================
// Combines all Boss3 configs and registers with character system
// This is the single entry point for the Boss3 character (The Bear)
// ============================================================================

import { registerCharacter, type CharacterDefinition } from '../registry';
import { registerCharacterProvider } from '../provider-registry';
import type { CharacterProvider } from '../providers';

// Spine configs
import { BOSS3_ASSETS } from './spine/assets';
import { BOSS3_BONE_MAP } from './spine/bone-map';
import { BOSS3_ANIMATIONS } from './spine/animation-map';
import { BOSS3_PROFILE } from './spine/model-profile';

// Combat configs
import { BOSS3_HITBOXES } from './combat/hitboxes';
import { BOSS3_HURTBOXES } from './combat/hurtboxes';

// Providers
import { Boss3AttackResolver, Boss3AnimationProvider } from './providers/boss3-providers';

/**
 * Complete Boss3 character definition
 */
const BOSS3_CHARACTER: CharacterDefinition = {
  id: 'boss3',
  name: 'The Bear',
  
  spine: {
    assets: BOSS3_ASSETS,
    mapping: {
      bones: BOSS3_BONE_MAP,
      animations: BOSS3_ANIMATIONS
    },
    profile: BOSS3_PROFILE
  },
  
  combat: {
    hitboxes: BOSS3_HITBOXES,
    hurtboxes: BOSS3_HURTBOXES
  }
};

/**
 * Boss3 character provider
 */
const BOSS3_PROVIDER: CharacterProvider = {
  id: 'boss3',
  attackResolver: new Boss3AttackResolver(),
  animationProvider: new Boss3AnimationProvider()
};

/**
 * Register the Boss3 character (called from registry initialization)
 */
export function registerBoss3(): void {
  registerCharacter(BOSS3_CHARACTER);
  registerCharacterProvider(BOSS3_PROVIDER);
}

// Export character definition for direct access if needed
export { BOSS3_CHARACTER };
