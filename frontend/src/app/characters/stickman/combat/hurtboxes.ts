// ============================================================================
// STICKMAN HURTBOX CONFIGURATION
// ============================================================================
// Defensive collision areas: head and body vulnerable zones
// Extracted and tuned specifically for Stickman character
// ============================================================================

export interface HurtboxConfig {
  // Circle hurtbox (for head)
  radius?: number;
  offsetX?: number;
  offsetY?: number;
  
  // Box hurtbox (for chest/body)
  width?: number;
  height?: number;
}

/**
 * Stickman hurtbox configurations
 * Tuned for stickman proportions and fair gameplay
 */
export const STICKMAN_HURTBOXES = {
  // Head hurtbox (circle)
  head: {
    radius: 65,
    offsetX: 0,
    offsetY: 65 // Slightly above bone center
  } satisfies HurtboxConfig,
  
  // Chest/torso hurtbox (box)  
  chest: {
    width: 30,
    height: 300,
    offsetX: 0,
    offsetY: -80 // Slightly below bone center
  } satisfies HurtboxConfig
} as const;