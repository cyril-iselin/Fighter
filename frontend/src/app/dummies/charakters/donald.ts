// ============================================================================
// DONALD DUMMY DEFINITION
// ============================================================================
// Walking character for hitbox testing
// ============================================================================

import { registerDummy, type DummyDefinition } from '../dummy-registry';

/**
 * Donald dummy configuration
 */
export const DONALD_DUMMY: DummyDefinition = {
  id: 'donald',
  name: 'Donald',
  
  // Asset paths
  spritesheetPath: 'assets/dummies/donald/texture.png',
  atlasPath: 'assets/dummies/donald/texture.json',
  
  // Visual properties
  scale: 1.5,  // Scale up for visibility
  
  // Gameplay properties
  speed: 130,  // Pixels per second
  hp: 100,
  
  // Hitbox (matches sprite size roughly)
  hitbox: {
    width: 80,
    height: 220,
    offsetX: 0,
    offsetY: 20
  },
  
  // Animation
  animation: {
    frameRate: 12  // 12 FPS for walk animation
  }
};

/**
 * Register Donald dummy
 */
export function registerDonald(): void {
  registerDummy(DONALD_DUMMY);
}
