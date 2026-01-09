// ============================================================================
// ADOLF DUMMY DEFINITION
// ============================================================================
// Walking character for hitbox testing
// ============================================================================

import { registerDummy, type DummyDefinition } from '../dummy-registry';

/**
 * Adolf dummy configuration
 */
export const ADOLF_DUMMY: DummyDefinition = {
  id: 'adolf',
  name: 'Adolf',
  
  // Asset paths
  spritesheetPath: 'assets/dummies/adolf/texture.png',
  atlasPath: 'assets/dummies/adolf/texture.json',
  
  // Visual properties
  scale: 1.2,  // Scale up for visibility
  flipX: true, // Sprite is mirrored, flip horizontally
  
  // Gameplay properties
  speed: 110,  // Pixels per second
  hp: 100,
  
  // Hitbox (matches sprite size roughly)
  hitbox: {
    width: 120,
    height: 440,
    offsetX: 0,
    offsetY: 0
  },
  
  // Animation
  animation: {
    frameRate: 12  // 12 FPS for walk animation
  }
};

/**
 * Register Adolf dummy
 */
export function registerAdolf(): void {
  registerDummy(ADOLF_DUMMY);
}
