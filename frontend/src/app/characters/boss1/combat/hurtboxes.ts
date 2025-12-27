// ============================================================================
// BOSS1 HURTBOX CONFIGURATION
// ============================================================================
// Defensive collision areas: head and body vulnerable zones
// Boss1 is a larger character so hurtboxes are bigger
// ============================================================================

export interface HurtboxConfig {
  radius?: number;
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
}

/**
 * Boss1 hurtbox configurations
 * Larger hurtboxes for the bigger boss character
 */
export const BOSS1_HURTBOXES = {
  // Head hurtbox (circle) - using images/head1 bone
  head: {
    radius: 70,
    offsetX: 20,
    offsetY: 20
  } satisfies HurtboxConfig,
  
  // Chest/torso hurtbox (box) - using hips bone
  chest: {
    width: 150,
    height: 260,
    offsetX: 10,
    offsetY: -120
  } satisfies HurtboxConfig
} as const;
