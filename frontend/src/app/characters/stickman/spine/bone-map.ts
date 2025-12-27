// ============================================================================
// STICKMAN BONE MAPPING
// ============================================================================
// Maps game-required bone names to actual Spine skeleton bone names
// REQUIRED BONES: head, chest, rightHand, leftHand, rightFoot, leftFoot, weaponLine
// Based on actual stickman fighter.json bone structure:
// - head: Head bone
// - chest: Chest/torso bone
// - arm_R2, arm_L2: Forearms (tip = hand position)
// - leg_R2, leg_L2: Shins (tip = foot position)
// ============================================================================

export const STICKMAN_BONE_MAP = {
  // Core body parts for hurtboxes
  head: 'head',
  chest: 'chest',
  
  // Attack limbs for hitboxes (forearm/shin bones - TIP is hand/foot)
  rightHand: 'arm_R2',
  leftHand: 'arm_L2',
  rightFoot: 'leg_R2',
  leftFoot: 'leg_L2',
  
  // Weapon slot for weaponLine hitbox (uses attachment geometry)
  weaponSlot: 'weapon',
} as const;