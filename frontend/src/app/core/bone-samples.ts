// ============================================================================
// BONE SAMPLES - Quantized Spine bone positions for hitbox calculation
// ============================================================================
// SpineAdapter samples bone positions/lines per tick and quantizes them.
// Core uses these samples as hitbox positions (bone-driven hitboxes).
//
// DESIGN:
// - Adapter reads Spine bone transforms (presentation layer)
// - Quantizes to integers (deterministic enough for record/replay)
// - Core uses samples directly for collision (no rig simulation)
//
// TRADEOFF:
// - ✅ Hitboxes match visual perfectly (no desyncs)
// - ⚠️ Not fully deterministic (Spine animation timing varies)
// - ✅ Mitigation: Quantize + record samples for MP replay
// ============================================================================

export interface BonePoint {
  x: number;  // World X (quantized to integer)
  y: number;  // World Y (quantized to integer)
}

export interface BoneLine {
  x1: number;  // Start X (quantized)
  y1: number;  // Start Y (quantized)
  x2: number;  // End X (quantized)
  y2: number;  // End Y (quantized)
}

/**
 * Bone samples per fighter (sampled from Spine skeleton per tick)
 */
export interface BoneSamples {
  // Attack anchors (points)
  rightHand: BonePoint;
  leftHand: BonePoint;
  rightFoot: BonePoint;
  leftFoot: BonePoint;
  
  // Weapon (line from grip to tip)
  weaponLine: BoneLine | null;  // null if no weapon equipped
  
  // Hurtbox anchors
  head: BonePoint;
  chest: BonePoint;
  
  // Metadata
  timestamp: number;  // Game tick when sampled
  fighterId: number;  // Which fighter (0 or 1)
}

/**
 * Quantize float to integer (for determinism in record/replay)
 */
export function quantize(value: number): number {
  return Math.round(value);
}

/**
 * Create empty bone samples (fallback when Spine not ready)
 */
export function createEmptyBoneSamples(fighterId: number, timestamp: number): BoneSamples {
  const defaultPoint: BonePoint = { x: 0, y: 0 };
  
  return {
    rightHand: defaultPoint,
    leftHand: defaultPoint,
    rightFoot: defaultPoint,
    leftFoot: defaultPoint,
    weaponLine: null,
    head: defaultPoint,
    chest: defaultPoint,
    timestamp,
    fighterId,
  };
}
