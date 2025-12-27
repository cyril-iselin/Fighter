// ============================================================================
// BONE-DRIVEN HITBOX CONFIG
// ============================================================================
// Defines ONLY which bone to use + hitbox shape (radius/thickness)
// NO timing info here! Active window comes from AttackConfig.timing
// ============================================================================

import type { AttackId } from './attack-types';

export type HitboxBone = 'rightHand' | 'leftHand' | 'rightFoot' | 'leftFoot' | 'weaponLine';

/**
 * Bone hitbox shape config with active window timing
 */
export interface BoneHitboxConfig {
  bone: HitboxBone;       // Which bone/line to use
  radius: number;         // Hitbox radius (for point bones)
  thickness?: number;     // Line thickness (for weaponLine only)
  offsetX?: number;       // Optional X offset from bone (default 0)
  offsetY?: number;       // Optional Y offset from bone (default 0)
  
  // Active window (fraction of attack duration)
  activeFromFrac?: number;  // Start of active window (default: 0.0 = attack start)
  activeToFrac?: number;    // End of active window (default: 0.35 = first 35% of attack)
}

/**
 * Attack hitbox definitions (bone + shape + active window)
 * Active window defaults: 0.0 - 0.35 (first 35% of attack duration)
 */
export const BONE_HITBOX_CONFIG: Record<AttackId, BoneHitboxConfig> = {
  // ============================================================================
  // PUNCHES (rightHand bone)
  // ============================================================================
  
  jab_single: {
    bone: 'rightHand',
    radius: 45,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  jab_double: {
    bone: 'rightHand',
    radius: 50,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  jab_high_single: {
    bone: 'rightHand',
    radius: 45,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  jab_high_double: {
    bone: 'rightHand',
    radius: 50,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  thousand_fists: {
    bone: 'rightHand',
    radius: 50,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  // ============================================================================
  // KICKS (rightFoot bone)
  // ============================================================================
  
  kick_high: {
    bone: 'rightFoot',
    radius: 50,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  kick_low: {
    bone: 'rightFoot',
    radius: 50,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  kick_straight: {
    bone: 'rightFoot',
    radius: 55,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  reverse_kick: {
    bone: 'rightFoot',
    radius: 40,
    activeFromFrac: 0.0,
    activeToFrac: 1.0,
  },
  
  flying_kick: {
    bone: 'leftFoot',  // Flying kick uses left foot
    radius: 50,
    activeFromFrac: 0.2,
    activeToFrac: 1.0,
  },
  
  salto_kick: {
    bone: 'rightFoot',
    radius: 150,
    activeFromFrac: 0.2,
    activeToFrac: 1.0,
  },
  
  // ============================================================================
  // WEAPON ATTACKS (weaponLine)
  // ============================================================================
  
  slash: {
    bone: 'weaponLine',
    radius: 0,         // Not used for lines
    thickness: 40,
    activeFromFrac: 0.4,
    activeToFrac: 0.7,
  },
  
  slash_heavy: {
    bone: 'weaponLine',
    radius: 0,
    thickness: 50,
    activeFromFrac: 0.4,
    activeToFrac: 0.7,
  },
};

/**
 * Hurtbox bone configuration (always active, no timing)
 * Supports different shapes for different body parts.
 */

// Shape definitions for hurtboxes
interface CircleHurtbox {
  shape: 'circle';
  bone: 'head';
  radius: number;
  offsetY?: number;
}

interface BoxHurtbox {
  shape: 'box';
  bone: 'chest'; // The box is anchored to the chest bone
  width: number;
  height: number;
  offsetY?: number; // Offset from the bone origin (e.g., to center the box)
}

type HurtboxConfig = CircleHurtbox | BoxHurtbox;

export const BONE_HURTBOX_CONFIG: {
  head: CircleHurtbox;
  chest: BoxHurtbox;
} = {
  head: {
    shape: 'circle',
    bone: 'head',
    radius: 65,
    offsetY: 65
  },
  chest: {
    shape: 'box',
    bone: 'chest',
    width: 60,  // Covers the torso width
    height: 300, // Extends from chest down towards the legs
    offsetY: -80 // Center the box vertically around the chest bone
  },
};
