// ============================================================================
// BOSS3 MODEL PROFILE
// ============================================================================
// Physical properties: scale, positioning, facing correction
// Boss3 (The Bear) is a larger character
// ============================================================================

export const BOSS3_PROFILE = {
  // Scale factor - boss is larger than stickman
  scale: 2.7,
  
  // Y offset to align feet with ground (negative = move down)
  groundOffsetY: -20,
  
  // Facing correction if character faces wrong direction by default
  facingCorrection: 1 // 1 = normal, -1 = flip horizontally
} as const;
