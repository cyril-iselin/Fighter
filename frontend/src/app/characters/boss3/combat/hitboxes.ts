// ============================================================================
// BOSS3 HITBOX CONFIGURATION
// ============================================================================
// Attack-specific hitbox configs: which bone to use, size, active window
// The Bear uses massive swords (images-swords slot on armb bone)
// ============================================================================

import type { AttackId } from '../../../core/attack-types';

export type HitboxBone = 'rightHand' | 'leftHand' | 'rightFoot' | 'leftFoot' | 'weaponLine';

export interface HitboxConfig {
  bone: HitboxBone | HitboxBone[];
  radius: number;
  thickness?: number;
  offsetX?: number;
  offsetY?: number;
  activeFromFrac?: number;
  activeToFrac?: number;
}

/**
 * Boss3 attack hitbox configurations
 * The Bear uses massive swords (weaponLine from images-swords slot)
 */
export const BOSS3_HITBOXES: Partial<Record<AttackId, HitboxConfig>> = {
  // Heavy attack - devastating sword swing
  boss3_heavy: {
    bone: 'weaponLine',
    radius: 60,
    thickness: 100,
    activeFromFrac: 0.3,
    activeToFrac: 0.7,
  },
  
  // Light attack - quick sword slash
  boss3_light: {
    bone: 'weaponLine',
    radius: 60,
    thickness: 100,
    activeFromFrac: 0.3,
    activeToFrac: 0.9,
  },
};
