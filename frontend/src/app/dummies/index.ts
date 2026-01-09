// ============================================================================
// DUMMY SYSTEM - PUBLIC API
// ============================================================================
// Exports and initialization for the dummy character system
// ============================================================================

// Re-export registry types and functions
export type { 
  DummyDefinition, 
  DummyHitbox, 
  DummyAnimation,
  AtlasData,
  AtlasFrame 
} from './dummy-registry';

export { 
  registerDummy, 
  getDummy, 
  getAllDummies, 
  hasDummy,
  loadAtlas,
  loadSpritesheet,
  getAnimationFrames
} from './dummy-registry';

// Re-export renderer
export { DummyRenderer, type DummyInstance } from './dummy-renderer';

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize all dummies (call from app startup)
 */
export async function initializeDummies(): Promise<void> {
  console.log('[Dummies] Initializing dummy registry...');
  
  // Import and register all dummies
  const donald = await import('./charakters/donald');
  donald.registerDonald();
  
  const vladi = await import('./charakters/vladi');
  vladi.registerVladi();
  
  const cyril = await import('./charakters/cyril');
  cyril.registerCyril();
  
  const adolf = await import('./charakters/adolf');
  adolf.registerAdolf();
  
  // Future dummies can be added here:
  // const otherDummy = await import('./charakters/other');
  // otherDummy.registerOther();
  
  console.log('[Dummies] All dummies initialized');
}
