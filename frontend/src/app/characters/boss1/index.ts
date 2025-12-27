// ============================================================================
// BOSS1 CHARACTER REGISTRATION
// ============================================================================
// Combines all Boss1 configs and registers with character system
// This is the single entry point for the Boss1 character (Jester)
// ============================================================================

import { registerCharacter, type CharacterDefinition } from '../registry';
import { registerCharacterProvider } from '../provider-registry';
import type { CharacterProvider } from '../providers';

// Spine configs
import { BOSS1_ASSETS } from './spine/assets';
import { BOSS1_BONE_MAP } from './spine/bone-map';
import { BOSS1_ANIMATIONS } from './spine/animation-map';
import { BOSS1_PROFILE } from './spine/model-profile';

// Combat configs
import { BOSS1_HITBOXES } from './combat/hitboxes';
import { BOSS1_HURTBOXES } from './combat/hurtboxes';

// Providers
import { Boss1AttackResolver, Boss1AnimationProvider } from './providers/boss1-providers';

/**
 * Complete Boss1 character definition
 */
const BOSS1_CHARACTER: CharacterDefinition = {
  id: 'boss1',
  name: 'Jester',
  
  spine: {
    assets: BOSS1_ASSETS,
    mapping: {
      bones: BOSS1_BONE_MAP,
      animations: BOSS1_ANIMATIONS
    },
    profile: BOSS1_PROFILE
  },
  
  combat: {
    hitboxes: BOSS1_HITBOXES,
    hurtboxes: BOSS1_HURTBOXES
  }
};

/**
 * Boss1 character provider
 */
const BOSS1_PROVIDER: CharacterProvider = {
  id: 'boss1',
  attackResolver: new Boss1AttackResolver(),
  animationProvider: new Boss1AnimationProvider()
};

/**
 * Register the Boss1 character (called from registry initialization)
 */
export function registerBoss1(): void {
  registerCharacter(BOSS1_CHARACTER);
  registerCharacterProvider(BOSS1_PROVIDER);
}

// Export character definition for direct access if needed
export { BOSS1_CHARACTER };
