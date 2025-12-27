// ============================================================================
// BOSS2 HURTBOX CONFIGURATION
// ============================================================================
// Defensive collision areas: head and body vulnerable zones
// Boss2 is a larger character so hurtboxes are bigger
// ============================================================================

export interface HurtboxConfig {
  radius?: number;
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
}

/**
 * Boss2 hurtbox configurations
 * Orc Warrior is a medium-sized boss
 * Bones: head -> images/head_01, chest -> hips
 */
export const BOSS2_HURTBOXES = {
  // Head hurtbox (circle) - orc head
  head: {
    radius: 75,
    offsetX: 10,
    offsetY: 30
  } satisfies HurtboxConfig,
  
  // Chest/torso hurtbox (box) - armored body
  chest: {
    width: 240,
    height: 380,
    offsetX: 0,
    offsetY: -70
  } satisfies HurtboxConfig
} as const;
