// ============================================================================
// BOSS3 BONE MAPPING
// ============================================================================
// Maps game-required bone names to actual Spine skeleton bone names
// Same bone structure as Boss1/Boss2
// ============================================================================

export const BOSS3_BONE_MAP = {
  // Core body parts for hurtboxes
  head: 'images/head_01',
  chest: 'hips',
  
  // Attack limbs for hitboxes
  rightHand: 'images/armf',     // Front hand/claw
  leftHand: 'images/armb',      // Back hand (holds swords)
  rightFoot: 'images/footf_01', // Front foot
  leftFoot: 'images/footb_01',  // Back foot
  
  // Weapon slot for weaponLine hitbox
  // Uses 'corners' axis because swords sprite is diagonal/complex shape
  weaponSlot: { slot: 'images-swords', axis: 'corners' },
} as const;
