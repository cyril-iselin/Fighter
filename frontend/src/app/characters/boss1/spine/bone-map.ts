// ============================================================================
// BOSS1 BONE MAPPING
// ============================================================================
// Maps game-required bone names to actual Spine skeleton bone names
// Based on skeleton.json bone structure:
// - images/head1: Head bone
// - images/armf_01: Front arm/weapon (hitbox)
// - images/armb_01: Back arm/weapon (hitbox)
// - hips: Body center for chest hurtbox
// ============================================================================

export const BOSS1_BONE_MAP = {
  // Core body parts for hurtboxes
  head: 'images/head1',
  chest: 'hips',
  
  // Attack limbs for hitboxes (both arms have weapons)
  rightHand: 'images/armf_01',  // Front arm weapon
  leftHand: 'images/armb_01',   // Back arm weapon
  rightFoot: 'images/shoesf_01', // Front foot
  leftFoot: 'images/shoesb_01',  // Back foot
} as const;
