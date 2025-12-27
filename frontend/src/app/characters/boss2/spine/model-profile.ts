// ============================================================================
// BOSS2 MODEL PROFILE
// ============================================================================
// Physical properties: scale, positioning, facing correction
// Boss2 (Orc Warrior) is a larger character
// ============================================================================

export const BOSS2_PROFILE = {
  // Scale factor - boss is larger than stickman
  scale: 2.5,
  
  // Y offset to align feet with ground (negative = move down)
  groundOffsetY: -32,
  
  // Facing correction if character faces wrong direction by default
  facingCorrection: 1 // 1 = normal, -1 = flip horizontally
} as const;
