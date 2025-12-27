// ============================================================================
// BOSS1 MODEL PROFILE
// ============================================================================
// Physical properties: scale, positioning, facing correction
// Boss1 (Jester) is a larger character
// Skeleton dimensions: width: 603.01, height: 464.78
// ============================================================================

export const BOSS1_PROFILE = {
  // Scale factor - boss is larger than stickman
  scale: 2.7,
  
  // Y offset to align feet with ground (negative = move down)
  // Boss1's skeleton origin is at the hips, so needs offset to lower feet to ground
  groundOffsetY: -85,
  
  // Facing correction if character faces wrong direction by default
  facingCorrection: 1 // 1 = normal, -1 = flip horizontally
} as const;
