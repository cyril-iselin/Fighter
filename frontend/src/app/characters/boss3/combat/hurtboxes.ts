// ============================================================================
// BOSS3 HURTBOX CONFIGURATION
// ============================================================================
// Defensive collision areas: head and body vulnerable zones
// Boss3 is a larger character so hurtboxes are bigger
// ============================================================================

export interface HurtboxConfig {
  radius?: number;
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
}

/**
 * Boss3 hurtbox configurations
 * The Bear is a large character - bigger hurtboxes
 * Bones: head -> images/head_01, chest -> hips
 */
export const BOSS3_HURTBOXES = {
  // Head hurtbox (circle) - bear head with mouth
  head: {
    radius: 75,
    offsetX: 40,
    offsetY: 50
  } satisfies HurtboxConfig,
  
  // Chest/torso hurtbox (box) - massive bear body
  chest: {
    width: 250,
    height: 350,
    offsetX: -40,
    offsetY: -50
  } satisfies HurtboxConfig
} as const;
