// ============================================================================
// VLADI DUMMY DEFINITION
// ============================================================================
// Walking character for hitbox testing
// ============================================================================

import { registerDummy, type DummyDefinition } from '../dummy-registry';

/**
 * Vladi dummy configuration
 */
export const VLADI_DUMMY: DummyDefinition = {
  id: 'vladi',
  name: 'Vladi',
  
  // Asset paths
  spritesheetPath: 'assets/dummies/vladi/texture.png',
  atlasPath: 'assets/dummies/vladi/texture.json',
  
  // Visual properties
  scale: 2.2,  // Scale up for visibility
  
  // Gameplay properties
  speed: 110,  // Pixels per second (etwas langsamer)
  hp: 150,
  
  // Hitbox (matches sprite size roughly)
  hitbox: {
    width: 80,
    height: 220,
    offsetX: 0,
    offsetY: 12
  },
  
  // Animation
  animation: {
    frameRate: 12  // 12 FPS for walk animation
  }
};

/**
 * Register Vladi dummy
 */
export function registerVladi(): void {
  registerDummy(VLADI_DUMMY);
}
