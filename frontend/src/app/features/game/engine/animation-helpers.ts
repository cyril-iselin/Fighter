// ============================================
// Animation Helpers - Loadout-aware animation selection
// ============================================

import { HitZone, LoadoutAnimations } from './types';

/**
 * Get the appropriate idle animation based on combat state
 */
export function getIdleAnimation(anims: LoadoutAnimations, inCombat: boolean): string {
  return inCombat ? anims.idleFightPose : anims.idle;
}

/**
 * Get the appropriate walk animation based on combat and fight pose state
 */
export function getWalkAnimation(
  anims: LoadoutAnimations, 
  inCombat: boolean, 
  fightPose: boolean
): string {
  if (inCombat && fightPose) {
    return anims.walkFightPose;
  }
  return anims.walkNormal;
}

/**
 * Get the appropriate run animation
 */
export function getRunAnimation(anims: LoadoutAnimations): string {
  return anims.run;
}

/**
 * Get block animation for the specified zone
 */
export function getBlockAnimation(anims: LoadoutAnimations, zone: HitZone): string {
  switch (zone) {
    case 'top': return anims.blockTop;
    case 'center': return anims.blockCenter;
    case 'bottom': return anims.blockCenter; // Fallback to center
  }
}

/**
 * Get hurt animation for the specified zone
 */
export function getHurtAnimation(anims: LoadoutAnimations, zone: HitZone): string {
  switch (zone) {
    case 'top': return anims.hurtTop;
    case 'center': return anims.hurtCenter;
    case 'bottom': return anims.hurtCenter; // Fallback to center
  }
}

/**
 * Get death animation for the specified variant
 */
export function getDeathAnimation(anims: LoadoutAnimations, variant: 'A' | 'B'): string {
  return variant === 'A' ? anims.dieA : anims.dieB;
}

/**
 * Get jump animations (takeoff + main)
 */
export function getJumpAnimations(anims: LoadoutAnimations, variant: 'A' | 'B' | 'C' | 'D' = 'A'): {
  takeoff: string;
  main: string;
} {
  switch (variant) {
    case 'A': return { takeoff: anims.jumpTakeoffA, main: anims.jumpA };
    case 'B': return { takeoff: anims.jumpTakeoffB, main: anims.jumpB };
    case 'C': return { takeoff: anims.jumpTakeoffC, main: anims.jumpC };
    case 'D': return { takeoff: anims.jumpTakeoffD, main: anims.jumpD };
  }
}
