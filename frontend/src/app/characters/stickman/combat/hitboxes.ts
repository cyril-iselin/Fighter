// ============================================================================
// STICKMAN HITBOX CONFIGURATION
// ============================================================================
// Attack-specific hitbox configs: which bone to use, size, active window
// Only includes attacks that exist in core AttackId type
// ============================================================================

import type { AttackId } from '../../../core/attack-types';

export type HitboxBone = 'rightHand' | 'leftHand' | 'rightFoot' | 'leftFoot' | 'weaponLine';

export interface HitboxConfig {
  bone: HitboxBone | HitboxBone[];  // Which bone/line to use (single or multiple)
  radius: number;           // Hitbox radius (for point bones)
  thickness?: number;       // Line thickness (for weaponLine only)
  offsetX?: number;         // Optional X offset from bone (default 0)
  offsetY?: number;         // Optional Y offset from bone (default 0)
  
  // Active window (fraction of attack duration)
  activeFromFrac?: number;  // Start of active window (default: 0.0)
  activeToFrac?: number;    // End of active window (default: 0.35)
}

/**
 * Stickman attack hitbox configurations
 * Only includes attacks that exist in core AttackId type
 */
export const STICKMAN_HITBOXES: Record<AttackId, HitboxConfig> = {
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