// ============================================================================
// BOSS1 HITBOX CONFIGURATION
// ============================================================================
// Attack-specific hitbox configs: which bone to use, size, active window
// Boss1 uses both arms (armf_01, armb_01) as weapon hitboxes
// ============================================================================

import type { AttackId } from '../../../core/attack-types';

export type HitboxBone = 'rightHand' | 'leftHand' | 'rightFoot' | 'leftFoot' | 'weaponLine';

export interface HitboxConfig {
  bone: HitboxBone | HitboxBone[];  // Single bone or array of bones
  radius: number;
  thickness?: number;
  offsetX?: number;
  offsetY?: number;
  activeFromFrac?: number;
  activeToFrac?: number;
}

/**
 * Boss1 attack hitbox configurations
 * Boss has larger hitboxes due to weapon size
 * Uses both hands for dual-weapon attacks
 */
export const BOSS1_HITBOXES: Partial<Record<AttackId, HitboxConfig>> = {
  // Heavy attack - uses weapon line for sweeping hitbox
  boss1_heavy: {
    bone: ['rightHand', 'leftHand'],
    radius: 90,
    offsetX: 50,          // Offset forward from hand
    activeFromFrac: 0.5,  // Active window starts later (wind-up)
    activeToFrac: 0.7,
  },
  
  // Light attack - uses BOTH arms (dual weapons)
  boss1_light: {
    bone: ['rightHand', 'leftHand'],  // Both arms deal damage
    radius: 90,
    offsetX: 60,          // Offset forward from hand
    activeFromFrac: 0.5,
    activeToFrac: 0.7,
  },
};
