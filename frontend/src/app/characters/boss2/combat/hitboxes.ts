// ============================================================================
// BOSS2 HITBOX CONFIGURATION
// ============================================================================
// Attack-specific hitbox configs: which bone to use, size, active window
// Boss2 uses both arms (armf_01, armb_01) as weapon hitboxes
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
 * Boss2 attack hitbox configurations
 * Orc Warrior uses his axe (weaponLine) for attacks
 */
export const BOSS2_HITBOXES: Partial<Record<AttackId, HitboxConfig>> = {
  // Heavy attack - big axe swing
  boss2_heavy: {
    bone: 'weaponLine',
    radius: 150,
    thickness: 180,
    activeFromFrac: 0.7,
    activeToFrac: 0.8,
  },
  
  // Light attack - quick axe slash
  boss2_light: {
    bone: 'weaponLine',
    radius: 110,
    thickness: 110,
    activeFromFrac: 0.75,
    activeToFrac: 0.9,
  },
};
