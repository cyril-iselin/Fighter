// ============================================================================
// STICKMAN MODEL PROFILE
// ============================================================================
// Physical properties: scale, positioning, facing correction
// Adjust these to align character with game world properly
// ============================================================================

export const STICKMAN_PROFILE = {
  // Overall scale factor (1.0 = original size)
  scale: 1.0,
  
  // Y offset to align feet with ground (positive = move up)
  groundOffsetY: 0,
  
  // Facing correction if character faces wrong direction by default
  facingCorrection: 1 // 1 = normal, -1 = flip horizontally
} as const;