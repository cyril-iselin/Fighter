// ============================================================================
// CYRIL DUMMY DEFINITION
// ============================================================================
// Walking character for hitbox testing
// ============================================================================

import { registerDummy, type DummyDefinition } from '../dummy-registry';

/**
 * Cyril dummy configuration
 */
export const CYRIL_DUMMY: DummyDefinition = {
  id: 'cyril',
  name: 'Cyril',
  
  // Asset paths
  spritesheetPath: 'assets/dummies/cyril/texture.png',
  atlasPath: 'assets/dummies/cyril/texture.json',
  
  // Visual properties
  scale: 1.5,  // Scale up for visibility
  
  // Gameplay properties
  speed: 130,  // Pixels per second
  hp: 120,
  
  // Hitbox (matches sprite size roughly)
  hitbox: {
    width: 80,
    height: 225,
    offsetX: 0,
    offsetY: 10
  },
  
  // Animation
  animation: {
    frameRate: 12  // 12 FPS for walk animation
  }
};

/**
 * Register Cyril dummy
 */
export function registerCyril(): void {
  registerDummy(CYRIL_DUMMY);
}
