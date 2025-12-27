// ============================================================================
// STICKMAN CHARACTER REGISTRATION
// ============================================================================
// Combines all stickman configs and registers with character system
// This is the single entry point for the Stickman character
// ============================================================================

import { registerCharacter, type CharacterDefinition } from '../registry';
import { registerCharacterProvider } from '../provider-registry';
import type { CharacterProvider } from '../providers';

// Spine configs
import { STICKMAN_ASSETS } from './spine/assets';
import { STICKMAN_BONE_MAP } from './spine/bone-map';
import { STICKMAN_ANIMATIONS } from './spine/animation-map';
import { STICKMAN_PROFILE } from './spine/model-profile';

// Combat configs  
import { STICKMAN_HITBOXES } from './combat/hitboxes';
import { STICKMAN_HURTBOXES } from './combat/hurtboxes';

// Providers
import { StickmanAttackResolver, StickmanAnimationProvider } from './providers/stickman-providers';

/**
 * Complete Stickman character definition
 */
const STICKMAN_CHARACTER: CharacterDefinition = {
  id: 'stickman',
  name: 'Stickman Fighter',
  
  spine: {
    assets: STICKMAN_ASSETS,
    mapping: {
      bones: STICKMAN_BONE_MAP,
      animations: STICKMAN_ANIMATIONS
    },
    profile: STICKMAN_PROFILE
  },
  
  combat: {
    hitboxes: STICKMAN_HITBOXES,
    hurtboxes: STICKMAN_HURTBOXES
  }
};

/**
 * Stickman character provider
 */
const STICKMAN_PROVIDER: CharacterProvider = {
  id: 'stickman',
  attackResolver: new StickmanAttackResolver(),
  animationProvider: new StickmanAnimationProvider()
};

/**
 * Register the Stickman character (called from registry initialization)
 */
export function registerStickman(): void {
  registerCharacter(STICKMAN_CHARACTER);
  registerCharacterProvider(STICKMAN_PROVIDER);
}

// Export character definition for direct access if needed
export { STICKMAN_CHARACTER };