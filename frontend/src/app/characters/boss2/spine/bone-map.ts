// ============================================================================
// BOSS2 BONE MAPPING
// ============================================================================
// Maps game-required bone names to actual Spine skeleton bone names
// Same bone structure as Boss1
// ============================================================================

export const BOSS2_BONE_MAP = {
  // Core body parts for hurtboxes
  head: 'images/head_01',
  chest: 'hips',
  
  // Attack limbs for hitboxes
  rightHand: 'images/armf',     // Front hand
  leftHand: 'images/armb',      // Back hand
  rightFoot: 'images/footf',    // Front foot
  leftFoot: 'images/footb',     // Back foot
  
  // Weapon slot for weaponLine hitbox (uses attachment geometry)
  weaponSlot: 'images-weapon',
} as const;
